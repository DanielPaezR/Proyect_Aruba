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
const MANAGERS: Role[] = [Role.JEFE, Role.SUPERVISOR];

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
 * Una ENTRADA solo es valida si no hay una entrada abierta; una SALIDA solo es
 * valida si hay una entrada abierta para cerrar. Es la unica fuente de verdad
 * para esto — la usan tanto el marcado manual (createTimeEntry) como el
 * automatico por geocerca (autoCheck), que en vez de lanzar error simplemente
 * no hace nada si la secuencia no aplica.
 */
function isValidPunchSequence(lastEntry: LastEntry, type: PunchType): boolean {
  if (type === PunchType.ENTRADA) {
    return lastEntry?.type !== PunchType.ENTRADA;
  }
  return lastEntry?.type === PunchType.ENTRADA;
}

export async function createTimeEntry(user: AuthUser, input: CreateTimeEntryInput) {
  if (input.activityId) {
    await ensureActivityAccessible(user, input.activityId);
  }

  const lastEntry = await getLastEntry(user.id);

  if (!isValidPunchSequence(lastEntry, input.type)) {
    if (input.type === PunchType.ENTRADA) {
      throw ApiError.conflict(ErrorCode.OPEN_ENTRY_EXISTS, "Ya tienes una entrada registrada sin una salida previa");
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
  totalMinutes: number;
  hasOpenEntry: boolean;
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
 * Horas trabajadas por usuario en un rango: empareja cada ENTRADA con la
 * SALIDA que le sigue. Una ENTRADA sin SALIDA todavia (hasOpenEntry) no suma
 * a totalMinutes — se muestra aparte para que quien revisa sepa que sigue
 * abierta, en vez de inflar el total silenciosamente en cada consulta.
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

  const [entries, proximityLogs] = await Promise.all([
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
  ]);

  const byUser = new Map<string, UserDaySummary>();
  function ensureBucket(userId: string, user: { id: string; name: string }): UserDaySummary {
    let bucket = byUser.get(userId);
    if (!bucket) {
      bucket = { user, entries: [], totalMinutes: 0, hasOpenEntry: false, unmatchedProximityLogs: [] };
      byUser.set(userId, bucket);
    }
    return bucket;
  }

  for (const entry of entries) {
    ensureBucket(entry.userId, entry.user).entries.push(entry);
  }

  for (const bucket of byUser.values()) {
    let openEntradaAt: Date | null = null;
    for (const entry of bucket.entries) {
      if (entry.type === PunchType.ENTRADA) {
        openEntradaAt = entry.timestamp;
      } else if (entry.type === PunchType.SALIDA && openEntradaAt) {
        bucket.totalMinutes += (entry.timestamp.getTime() - openEntradaAt.getTime()) / 60000;
        openEntradaAt = null;
      }
    }
    bucket.hasOpenEntry = openEntradaAt !== null;
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
