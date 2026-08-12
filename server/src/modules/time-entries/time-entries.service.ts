import { PunchType, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateTimeEntryInput } from "./time-entries.validators";

type AuthUser = { id: string; role: Role };

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

export async function createTimeEntry(user: AuthUser, input: CreateTimeEntryInput) {
  if (input.activityId) {
    await ensureActivityAccessible(user, input.activityId);
  }

  const lastEntry = await prisma.timeEntry.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });

  if (input.type === PunchType.ENTRADA && lastEntry?.type === PunchType.ENTRADA) {
    throw ApiError.conflict(ErrorCode.OPEN_ENTRY_EXISTS, "Ya tienes una entrada registrada sin una salida previa");
  }

  if (input.type === PunchType.SALIDA && (!lastEntry || lastEntry.type === PunchType.SALIDA)) {
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
