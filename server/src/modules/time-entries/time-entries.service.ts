import { Prisma, PunchType, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import * as settingsService from "../settings/settings.service";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { arubaDayRangeUtc, arubaStartOfTodayUtc, haversineDistanceMeters } from "../../utils/geo";
import type { AutoCheckInput, CreateTimeEntryInput, SummaryQuery, UpdateTimeEntryInput } from "./time-entries.validators";

type AuthUser = { id: string; role: Role };
type LastEntry = { type: PunchType } | null;

// Ver comentario equivalente en activities.service.ts: ensureActivityAccessible
// no tiene authorize() a nivel de ruta, asi que el chequeo de rol tiene que
// ser explicito aca para no dejar pasar por descarte a un rol nuevo.
const MANAGERS: Role[] = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

const timeEntryInclude = {
  user: { select: { id: true, name: true } },
  activity: { select: { id: true, title: true, projectId: true } },
  editedBy: { select: { id: true, name: true } },
} as const;

type TimeEntryWithRelations = Prisma.TimeEntryGetPayload<{ include: typeof timeEntryInclude }>;

function dateRangeWhere(filters: { from?: Date; to?: Date }) {
  if (!filters.from && !filters.to) {
    return {};
  }
  return {
    timestamp: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

async function ensureActivityAccessible(user: AuthUser, activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { assignments: true },
  });

  if (!activity) {
    throw ApiError.notFound(ErrorCode.ACTIVITY_NOT_FOUND, "Actividad no encontrada");
  }

  if (user.role === Role.TRABAJADOR_CAMPO) {
    const isAssigned = activity.assignments.some((a) => a.userId === user.id);
    if (!isAssigned) {
      throw ApiError.forbidden(ErrorCode.ACTIVITY_NOT_ASSIGNED, "No tienes esta actividad asignada");
    }
  } else if (!MANAGERS.includes(user.role)) {
    throw ApiError.forbidden();
  }
}

function getLastEntry(userId: string): Promise<LastEntry> {
  return prisma.timeEntry.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
    select: { type: true },
  });
}

/**
 * Secuencia de 4 estados (ver ultimo tipo marcado):
 *   sin marcacion abierta (o ultimo SALIDA) -> solo ENTRADA
 *   ultimo ENTRADA                          -> ALMUERZO_INICIO o SALIDA
 *   ultimo ALMUERZO_INICIO                  -> solo ALMUERZO_FIN
 *   ultimo ALMUERZO_FIN                     -> ALMUERZO_INICIO (otro descanso) o SALIDA
 * Es la unica fuente de verdad para esto — la usan tanto el marcado manual
 * (createTimeEntry) como getTodayStatus (para decidir que botones mostrar) y
 * el automatico por geocerca (autoCheck, que ya no marca ENTRADA/SALIDA pero
 * comparte el mismo tipo LastEntry).
 */
function isValidPunchSequence(lastEntry: LastEntry, type: PunchType): boolean {
  const last = lastEntry?.type ?? null;
  switch (type) {
    case PunchType.ENTRADA:
      return last === null || last === PunchType.SALIDA;
    case PunchType.ALMUERZO_INICIO:
      return last === PunchType.ENTRADA || last === PunchType.ALMUERZO_FIN;
    case PunchType.ALMUERZO_FIN:
      return last === PunchType.ALMUERZO_INICIO;
    case PunchType.SALIDA:
      return last === PunchType.ENTRADA || last === PunchType.ALMUERZO_FIN;
    default:
      return false;
  }
}

const ALL_PUNCH_TYPES: PunchType[] = [
  PunchType.ENTRADA,
  PunchType.ALMUERZO_INICIO,
  PunchType.ALMUERZO_FIN,
  PunchType.SALIDA,
];

export async function createTimeEntry(user: AuthUser, input: CreateTimeEntryInput) {
  if (input.activityId) {
    await ensureActivityAccessible(user, input.activityId);
  }

  const lastEntry = await getLastEntry(user.id);

  if (!isValidPunchSequence(lastEntry, input.type)) {
    const last = lastEntry?.type ?? null;
    if (input.type === PunchType.ENTRADA) {
      throw ApiError.conflict(ErrorCode.OPEN_ENTRY_EXISTS, "Ya tienes una entrada registrada sin una salida previa");
    }
    if (input.type === PunchType.ALMUERZO_INICIO) {
      if (last === PunchType.ALMUERZO_INICIO) {
        throw ApiError.conflict(ErrorCode.ALREADY_ON_LUNCH, "Ya estás en tu almuerzo");
      }
      throw ApiError.conflict(ErrorCode.NO_OPEN_ENTRY_FOR_LUNCH, "No tienes una entrada abierta para marcar almuerzo");
    }
    if (input.type === PunchType.ALMUERZO_FIN) {
      throw ApiError.conflict(ErrorCode.NO_OPEN_LUNCH, "No tienes un almuerzo abierto para finalizar");
    }
    // SALIDA
    if (last === PunchType.ALMUERZO_INICIO) {
      throw ApiError.conflict(ErrorCode.CANNOT_EXIT_DURING_LUNCH, "Debes finalizar tu almuerzo antes de marcar salida");
    }
    throw ApiError.conflict(ErrorCode.NO_OPEN_ENTRY, "No tienes una entrada abierta para registrar una salida");
  }

  return prisma.timeEntry.create({
    data: {
      userId: user.id,
      activityId: input.activityId,
      type: input.type,
      latitude: input.latitude,
      longitude: input.longitude,
    },
    include: timeEntryInclude,
  });
}

export interface AutoCheckResult {
  logged: boolean;
  distanceMeters: number | null;
}

/**
 * Ya NO marca ENTRADA/SALIDA — el marcado real es siempre una accion manual
 * del trabajador (ver createTimeEntry). Este endpoint corre en segundo plano
 * y solo dos cosas: (1) actualiza la ultima ubicacion conocida del usuario,
 * para que el mapa de ubicaciones no tenga que pedir geolocalizacion aparte,
 * y (2) si el trabajador esta dentro del radio configurado de la oficina,
 * guarda un GeofenceProximityLog de referencia ("estuvo cerca a esta hora")
 * que un manager puede usar despues para detectar un olvido de marcado.
 * Silencioso por diseno: nunca lanza error, para que el cliente pueda
 * llamarlo sin manejar casos de fallo.
 */
export async function autoCheck(user: AuthUser, input: AutoCheckInput): Promise<AutoCheckResult> {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastKnownLatitude: input.latitude,
      lastKnownLongitude: input.longitude,
      lastLocationAt: new Date(),
    },
  });

  const settings = await settingsService.getSettings();
  if (settings.officeLatitude === null || settings.officeLongitude === null) {
    return { logged: false, distanceMeters: null };
  }

  const distance = haversineDistanceMeters(
    input.latitude,
    input.longitude,
    settings.officeLatitude,
    settings.officeLongitude,
  );
  if (distance > settings.officeRadiusMeters) {
    return { logged: false, distanceMeters: distance };
  }

  await prisma.geofenceProximityLog.create({
    data: {
      userId: user.id,
      latitude: input.latitude,
      longitude: input.longitude,
      distanceMeters: distance,
    },
  });

  return { logged: true, distanceMeters: distance };
}

export async function listMine(userId: string, filters: { from?: Date; to?: Date }) {
  return prisma.timeEntry.findMany({
    where: { userId, ...dateRangeWhere(filters) },
    include: timeEntryInclude,
    orderBy: { timestamp: "desc" },
  });
}

export async function listForManagers(filters: { userId?: string; from?: Date; to?: Date }) {
  return prisma.timeEntry.findMany({
    where: {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...dateRangeWhere(filters),
    },
    include: timeEntryInclude,
    orderBy: { timestamp: "desc" },
  });
}

export interface ProximityLogReference {
  id: string;
  detectedAt: Date;
  distanceMeters: number;
}

export interface UserDaySummary {
  user: { id: string; name: string };
  entries: TimeEntryWithRelations[];
  // Neto: (SALIDA - ENTRADA) menos el tiempo de almuerzo de cada sesion, no
  // el bruto — el almuerzo nunca cuenta como trabajado.
  totalMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  lunchMinutes: number;
  hasOpenEntry: boolean;
  hasOpenLunch: boolean;
  // GeofenceProximityLog de este rango que no cae cerca (en el tiempo) de
  // ninguna marcacion real — referencia informativa de "estuvo cerca de la
  // oficina" para cuando el trabajador olvido marcar. Nunca reemplaza ni
  // cuenta como una marcacion.
  unmatchedProximityLogs: ProximityLogReference[];
}

// Una marcacion real dentro de esta ventana de un log de proximidad se
// considera "el mismo evento" (el trabajador tardo unos minutos en abrir la
// app y marcar despues de llegar) — el log deja de mostrarse como referencia.
const PROXIMITY_REFERENCE_WINDOW_MINUTES = 30;

function isNearAnyEntry(detectedAt: Date, entries: { timestamp: Date }[]): boolean {
  const windowMs = PROXIMITY_REFERENCE_WINDOW_MINUTES * 60 * 1000;
  return entries.some((entry) => Math.abs(entry.timestamp.getTime() - detectedAt.getTime()) <= windowMs);
}

/**
 * Camina las marcaciones de un dia/rango en orden y devuelve los acumulados
 * de sesiones YA CERRADAS (una SALIDA cierra la ENTRADA correspondiente,
 * restando cualquier almuerzo tomado en esa sesion). No cuenta nada de una
 * sesion que siga abierta al final del rango — eso es responsabilidad de
 * quien llama (getSummary la deja fuera del total; getTodayStatus la suma
 * en vivo usando la hora actual). Compartido por los dos para no repetir la
 * misma logica de emparejar ENTRADA/ALMUERZO_INICIO/ALMUERZO_FIN/SALIDA.
 */
export function walkClosedSessions(entries: { type: PunchType; timestamp: Date }[]): {
  netMinutes: number;
  lunchMinutes: number;
  openEntradaAt: Date | null;
  openLunchAt: Date | null;
  sessionLunchMinutesSoFar: number;
} {
  let openEntradaAt: Date | null = null;
  let openLunchAt: Date | null = null;
  let sessionLunchMinutes = 0;
  let netMinutes = 0;
  let lunchMinutes = 0;

  for (const entry of entries) {
    if (entry.type === PunchType.ENTRADA) {
      openEntradaAt = entry.timestamp;
      sessionLunchMinutes = 0;
    } else if (entry.type === PunchType.ALMUERZO_INICIO && openEntradaAt) {
      openLunchAt = entry.timestamp;
    } else if (entry.type === PunchType.ALMUERZO_FIN && openLunchAt) {
      const minutes = (entry.timestamp.getTime() - openLunchAt.getTime()) / 60000;
      sessionLunchMinutes += minutes;
      lunchMinutes += minutes;
      openLunchAt = null;
    } else if (entry.type === PunchType.SALIDA && openEntradaAt) {
      const grossMinutes = (entry.timestamp.getTime() - openEntradaAt.getTime()) / 60000;
      netMinutes += Math.max(0, grossMinutes - sessionLunchMinutes);
      openEntradaAt = null;
      sessionLunchMinutes = 0;
    }
  }

  return { netMinutes, lunchMinutes, openEntradaAt, openLunchAt, sessionLunchMinutesSoFar: sessionLunchMinutes };
}

/**
 * Horas trabajadas por usuario en un rango: empareja cada ENTRADA con la
 * SALIDA que le sigue, restando el tiempo de almuerzo de cada sesion (ver
 * walkClosedSessions). Una ENTRADA sin SALIDA todavia (hasOpenEntry) no suma
 * a totalMinutes — se muestra aparte para que quien revisa sepa que sigue
 * abierta, en vez de inflar el total silenciosamente en cada consulta. De lo
 * neto, lo que exceda standardDailyMinutes (CompanySettings) cuenta como
 * overtimeMinutes.
 *
 * Tambien adjunta, por usuario, los GeofenceProximityLog del mismo rango que
 * no tienen una marcacion real cerca en el tiempo — referencia para el
 * manager cuando revisa las horas y el trabajador olvido marcar.
 */
export async function getSummary(filters: SummaryQuery): Promise<UserDaySummary[]> {
  let start: Date;
  let end: Date | undefined;

  if (filters.date) {
    ({ start, end } = arubaDayRangeUtc(filters.date));
  } else if (filters.from || filters.to) {
    start = filters.from ?? new Date(0);
    end = filters.to;
  } else {
    start = arubaStartOfTodayUtc();
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }

  const userFilter = filters.userId ? { userId: filters.userId } : { user: { role: Role.TRABAJADOR_CAMPO } };

  const [entries, proximityLogs, settings] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { ...userFilter, timestamp: { gte: start, ...(end ? { lt: end } : {}) } },
      include: timeEntryInclude,
      orderBy: [{ userId: "asc" }, { timestamp: "asc" }],
    }),
    prisma.geofenceProximityLog.findMany({
      where: { ...userFilter, detectedAt: { gte: start, ...(end ? { lt: end } : {}) } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ userId: "asc" }, { detectedAt: "asc" }],
    }),
    settingsService.getSettings(),
  ]);

  const byUser = new Map<string, UserDaySummary>();
  function ensureBucket(userId: string, user: { id: string; name: string }): UserDaySummary {
    let bucket = byUser.get(userId);
    if (!bucket) {
      bucket = {
        user,
        entries: [],
        totalMinutes: 0,
        normalMinutes: 0,
        overtimeMinutes: 0,
        lunchMinutes: 0,
        hasOpenEntry: false,
        hasOpenLunch: false,
        unmatchedProximityLogs: [],
      };
      byUser.set(userId, bucket);
    }
    return bucket;
  }

  for (const entry of entries) {
    ensureBucket(entry.userId, entry.user).entries.push(entry);
  }

  for (const bucket of byUser.values()) {
    const { netMinutes, lunchMinutes, openEntradaAt, openLunchAt } = walkClosedSessions(bucket.entries);
    bucket.totalMinutes = netMinutes;
    bucket.lunchMinutes = lunchMinutes;
    bucket.normalMinutes = Math.min(netMinutes, settings.standardDailyMinutes);
    bucket.overtimeMinutes = Math.max(0, netMinutes - settings.standardDailyMinutes);
    bucket.hasOpenEntry = openEntradaAt !== null;
    bucket.hasOpenLunch = openLunchAt !== null;
  }

  for (const log of proximityLogs) {
    const bucket = ensureBucket(log.userId, log.user);
    if (!isNearAnyEntry(log.detectedAt, bucket.entries)) {
      bucket.unmatchedProximityLogs.push({
        id: log.id,
        detectedAt: log.detectedAt,
        distanceMeters: log.distanceMeters,
      });
    }
  }

  return Array.from(byUser.values());
}

export async function updateTimeEntry(editor: AuthUser, timeEntryId: string, input: UpdateTimeEntryInput) {
  const existing = await prisma.timeEntry.findUnique({ where: { id: timeEntryId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.TIME_ENTRY_NOT_FOUND, "Marcación no encontrada");
  }

  return prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      timestamp: input.timestamp,
      // Solo se guarda la primera vez que se edita — asi originalTimestamp
      // siempre refleja lo que el trabajador marco de verdad, no la ultima edicion.
      originalTimestamp: existing.originalTimestamp ?? existing.timestamp,
      editedById: editor.id,
      editedAt: new Date(),
      editReason: input.editReason,
    },
    include: timeEntryInclude,
  });
}

export interface TodayTimeStatus {
  lastPunchType: PunchType | null;
  // Que botones deberia mostrar el cliente ahora mismo — unica fuente de
  // verdad (isValidPunchSequence), el cliente no reimplementa la secuencia.
  validNextTypes: PunchType[];
  workedMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  lunchMinutes: number;
  // null si el usuario no tiene hourlyRate configurado (ej. no todos los
  // roles lo tienen) — no hay estimado sensato sin una tarifa base.
  earningsEstimate: number | null;
}

/**
 * Estado de hoy para el trabajador autenticado, en vivo: si tiene una sesion
 * o un almuerzo abiertos, usa la hora actual como si fuera el "corte" (sin
 * escribir nada) para que el contador de horas/ganancia estimada avance
 * mientras la pantalla esta abierta, en vez de quedar congelado desde la
 * ultima marcacion. Mismo pairing ENTRADA/ALMUERZO_INICIO/ALMUERZO_FIN/
 * SALIDA que getSummary (ver walkClosedSessions), mas la sesion abierta.
 */
export async function getTodayStatus(user: AuthUser): Promise<TodayTimeStatus> {
  const start = arubaStartOfTodayUtc();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [entries, settings, fullUser] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, timestamp: { gte: start, lt: end } },
      orderBy: { timestamp: "asc" },
      select: { type: true, timestamp: true },
    }),
    settingsService.getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { hourlyRate: true, overtimeHourlyRate: true } }),
  ]);

  const now = new Date();
  const { netMinutes, lunchMinutes, openEntradaAt, openLunchAt, sessionLunchMinutesSoFar } =
    walkClosedSessions(entries);

  let liveNetMinutes = netMinutes;
  let liveLunchMinutes = lunchMinutes;

  if (openEntradaAt) {
    if (openLunchAt) {
      // En almuerzo ahora mismo: las horas trabajadas se congelan en el
      // momento en que empezo el almuerzo, no siguen sumando.
      const sessionWorkedSoFar = (openLunchAt.getTime() - openEntradaAt.getTime()) / 60000 - sessionLunchMinutesSoFar;
      liveNetMinutes += Math.max(0, sessionWorkedSoFar);
      liveLunchMinutes += (now.getTime() - openLunchAt.getTime()) / 60000;
    } else {
      const sessionWorkedSoFar = (now.getTime() - openEntradaAt.getTime()) / 60000 - sessionLunchMinutesSoFar;
      liveNetMinutes += Math.max(0, sessionWorkedSoFar);
    }
  }

  const normalMinutes = Math.min(liveNetMinutes, settings.standardDailyMinutes);
  const overtimeMinutes = Math.max(0, liveNetMinutes - settings.standardDailyMinutes);

  const lastPunchType = entries.length > 0 ? entries[entries.length - 1].type : null;
  const lastEntry: LastEntry = lastPunchType ? { type: lastPunchType } : null;
  const validNextTypes = ALL_PUNCH_TYPES.filter((type) => isValidPunchSequence(lastEntry, type));

  let earningsEstimate: number | null = null;
  if (fullUser?.hourlyRate) {
    const normalRate = fullUser.hourlyRate.toNumber();
    const overtimeRate = fullUser.overtimeHourlyRate ? fullUser.overtimeHourlyRate.toNumber() : normalRate;
    earningsEstimate =
      Math.round(((normalMinutes / 60) * normalRate + (overtimeMinutes / 60) * overtimeRate) * 100) / 100;
  }

  return {
    lastPunchType,
    validNextTypes,
    workedMinutes: Math.round(liveNetMinutes),
    normalMinutes: Math.round(normalMinutes),
    overtimeMinutes: Math.round(overtimeMinutes),
    lunchMinutes: Math.round(liveLunchMinutes),
    earningsEstimate,
  };
}
