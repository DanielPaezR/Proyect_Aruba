import { ActivityStatus, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateActivityInput, UpdateActivityInput } from "./activities.validators";

type AuthUser = { id: string; role: Role };

const activityInclude = {
  assignments: { include: { user: { select: { id: true, name: true } } } },
  _count: { select: { evidences: true } },
} as const;

/** Un Trabajador de Campo solo ve actividades donde está asignado. */
function visibilityWhere(user: AuthUser) {
  if (user.role === Role.TRABAJADOR_CAMPO) {
    return { assignments: { some: { userId: user.id } } };
  }
  return {};
}

export async function listActivitiesForProject(
  user: AuthUser,
  projectId: string,
  filters: { status?: ActivityStatus; assignedToId?: string },
) {
  await ensureProjectExists(projectId);

  return prisma.activity.findMany({
    where: {
      projectId,
      ...visibilityWhere(user),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignedToId ? { assignments: { some: { userId: filters.assignedToId } } } : {}),
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function listMyActivities(userId: string, filters: { status?: ActivityStatus }) {
  return prisma.activity.findMany({
    where: {
      assignments: { some: { userId } },
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: { ...activityInclude, project: { select: { id: true, name: true } } },
    orderBy: { scheduledDate: "asc" },
  });
}

export async function getActivity(user: AuthUser, activityId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, ...visibilityWhere(user) },
    include: {
      ...activityInclude,
      project: { select: { id: true, name: true, status: true } },
      evidences: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!activity) {
    throw ApiError.notFound(ErrorCode.ACTIVITY_NOT_FOUND, "Actividad no encontrada");
  }

  return activity;
}

export async function createActivity(projectId: string, input: CreateActivityInput) {
  await ensureProjectExists(projectId);

  if (input.assignedUserIds?.length) {
    await ensureUsersAreFieldWorkers(input.assignedUserIds);
  }

  return prisma.activity.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      scheduledDate: input.scheduledDate,
      assignments: input.assignedUserIds?.length
        ? { create: input.assignedUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: activityInclude,
  });
}

export async function updateActivity(activityId: string, input: UpdateActivityInput) {
  await ensureActivityExists(activityId);
  return prisma.activity.update({ where: { id: activityId }, data: input, include: activityInclude });
}

export async function deleteActivity(activityId: string) {
  await ensureActivityExists(activityId);
  await prisma.activity.delete({ where: { id: activityId } });
}

const WORKER_ALLOWED_TRANSITIONS: ActivityStatus[] = [ActivityStatus.EN_PROGRESO, ActivityStatus.COMPLETADA];

export async function updateActivityStatus(user: AuthUser, activityId: string, status: ActivityStatus) {
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
    if (!WORKER_ALLOWED_TRANSITIONS.includes(status)) {
      throw ApiError.forbidden(
        ErrorCode.INVALID_STATUS_TRANSITION,
        "Un trabajador de campo solo puede marcar En Progreso o Completada",
      );
    }
  }

  return prisma.activity.update({
    where: { id: activityId },
    data: {
      status,
      completedAt: status === ActivityStatus.COMPLETADA ? new Date() : null,
    },
    include: activityInclude,
  });
}

export async function assignWorker(activityId: string, userId: string) {
  await ensureActivityExists(activityId);
  await ensureUsersAreFieldWorkers([userId]);

  const existing = await prisma.activityAssignment.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (existing) {
    throw ApiError.conflict(ErrorCode.ALREADY_ASSIGNED, "El trabajador ya está asignado a esta actividad");
  }

  return prisma.activityAssignment.create({
    data: { activityId, userId },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function unassignWorker(activityId: string, userId: string) {
  const existing = await prisma.activityAssignment.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.ASSIGNMENT_NOT_FOUND, "El trabajador no está asignado a esta actividad");
  }
  await prisma.activityAssignment.delete({ where: { id: existing.id } });
}

async function ensureProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
}

async function ensureActivityExists(activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true } });
  if (!activity) {
    throw ApiError.notFound(ErrorCode.ACTIVITY_NOT_FOUND, "Actividad no encontrada");
  }
}

async function ensureUsersAreFieldWorkers(userIds: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  if (users.length !== userIds.length) {
    throw ApiError.badRequest(ErrorCode.USER_NOT_FOUND, "Alguno de los usuarios a asignar no existe");
  }
  const invalid = users.find((u) => u.role !== Role.TRABAJADOR_CAMPO);
  if (invalid) {
    throw ApiError.badRequest(
      ErrorCode.USER_NOT_FIELD_WORKER,
      `El usuario ${invalid.name} no es un Trabajador de Campo`,
    );
  }
}
