import { PunchType, Role, TimeEntrySource } from "@prisma/client";
import { prisma } from "../../config/prisma";
import * as settingsService from "../settings/settings.service";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { currentArubaMinutes, haversineDistanceMeters, isWithinWindow } from "../../utils/geo";
import type { AutoCheckInput, CreateTimeEntryInput } from "./time-entries.validators";

type AuthUser = { id: string; role: Role };
type LastEntry = { type: PunchType } | null;

const timeEntryInclude = {
  user: { select: { id: true, name: true } },
  activity: { select: { id: true, title: true, projectId: true } },
} as const;

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
  created: boolean;
  timeEntry: Awaited<ReturnType<typeof prisma.timeEntry.create>> | null;
}

/**
 * Marcado automatico por geocerca: silencioso por diseno. Si la oficina no
 * esta configurada, el usuario esta fuera del radio, la hora no cae en
 * ninguna ventana, o la secuencia ENTRADA/SALIDA no aplica (ya se marco hoy),
 * simplemente no hace nada — nunca lanza error, para que el cliente pueda
 * llamarlo en segundo plano sin manejar casos de fallo.
 *
 * Siempre actualiza la ultima ubicacion conocida del usuario, se haya
 * marcado o no, para que el mapa de ubicaciones (prompt D) no tenga que
 * pedir geolocalizacion de nuevo por separado.
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
    return { created: false, timeEntry: null };
  }

  const distance = haversineDistanceMeters(
    input.latitude,
    input.longitude,
    settings.officeLatitude,
    settings.officeLongitude,
  );
  if (distance > settings.officeRadiusMeters) {
    return { created: false, timeEntry: null };
  }

  const nowMinutes = currentArubaMinutes();
  let type: PunchType;
  if (isWithinWindow(nowMinutes, settings.morningWindowStart, settings.morningWindowEnd)) {
    type = PunchType.ENTRADA;
  } else if (isWithinWindow(nowMinutes, settings.afternoonWindowStart, settings.afternoonWindowEnd)) {
    type = PunchType.SALIDA;
  } else {
    return { created: false, timeEntry: null };
  }

  const lastEntry = await getLastEntry(user.id);
  if (!isValidPunchSequence(lastEntry, type)) {
    return { created: false, timeEntry: null };
  }

  const timeEntry = await prisma.timeEntry.create({
    data: {
      userId: user.id,
      type,
      latitude: input.latitude,
      longitude: input.longitude,
      source: TimeEntrySource.AUTO_GEOFENCE,
    },
    include: timeEntryInclude,
  });

  return { created: true, timeEntry };
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
