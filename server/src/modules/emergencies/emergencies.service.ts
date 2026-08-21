import { EmergencyStatus, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { sendPushToUser } from "../../utils/push";
import type {
  AssignEmergencyInput,
  CreateEmergencyInput,
  ListEmergenciesQuery,
  ResolveEmergencyInput,
  UpdateEmergencyInput,
} from "./emergencies.validators";

const emergencyInclude = {
  reportedBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  assignments: { include: { user: { select: { id: true, name: true } } } },
} as const;

async function ensureProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
}

async function getEmergencyOrThrow(emergencyId: string) {
  const emergency = await prisma.emergency.findUnique({ where: { id: emergencyId } });
  if (!emergency) {
    throw ApiError.notFound(ErrorCode.EMERGENCY_NOT_FOUND, "Emergencia no encontrada");
  }
  return emergency;
}

export async function createEmergency(reporterId: string, input: CreateEmergencyInput) {
  if (input.projectId) {
    await ensureProjectExists(input.projectId);
  }

  return prisma.emergency.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      locationMapsUrl: input.locationMapsUrl,
      priority: input.priority,
      reportedById: reporterId,
    },
    include: emergencyInclude,
  });
}

export async function listEmergencies(filters: ListEmergenciesQuery) {
  return prisma.emergency.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}) },
    include: emergencyInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Emergencias asignadas al trabajador autenticado — mismo criterio que
 * activities.service.ts listMyActivities. */
export async function listMyEmergencies(userId: string) {
  return prisma.emergency.findMany({
    where: { assignments: { some: { userId } } },
    include: emergencyInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateEmergency(emergencyId: string, input: UpdateEmergencyInput) {
  await getEmergencyOrThrow(emergencyId);

  if (input.projectId) {
    await ensureProjectExists(input.projectId);
  }

  return prisma.emergency.update({
    where: { id: emergencyId },
    data: {
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locationMapsUrl !== undefined ? { locationMapsUrl: input.locationMapsUrl } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: emergencyInclude,
  });
}

/**
 * Asigna un trabajador a la emergencia: si todavia estaba en REPORTADA, pasa
 * a ASIGNADA en el mismo paso (no hace falta un segundo llamado manual para
 * algo que la propia asignacion ya implica). Manda push inmediato con
 * urgency "high" — a diferencia del recordatorio de marcado (cron), esto es
 * un aviso puntual apenas se decide quien va, y el navegador/push service
 * del trabajador debe priorizarlo frente a notificaciones normales.
 */
export async function assignWorker(emergencyId: string, input: AssignEmergencyInput) {
  const emergency = await getEmergencyOrThrow(emergencyId);

  const worker = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!worker) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (worker.role !== Role.TRABAJADOR_CAMPO) {
    throw ApiError.badRequest(
      ErrorCode.USER_NOT_FIELD_WORKER,
      `El usuario ${worker.name} no es un Trabajador de Campo`,
    );
  }

  const existing = await prisma.emergencyAssignment.findUnique({
    where: { emergencyId_userId: { emergencyId, userId: input.userId } },
  });
  if (existing) {
    throw ApiError.conflict(ErrorCode.ALREADY_ASSIGNED, "El trabajador ya está asignado a esta emergencia");
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.emergencyAssignment.create({
      data: { emergencyId, userId: input.userId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (emergency.status === EmergencyStatus.REPORTADA) {
      await tx.emergency.update({ where: { id: emergencyId }, data: { status: EmergencyStatus.ASIGNADA } });
    }

    return created;
  });

  const locationSuffix = emergency.locationMapsUrl ? ` — ${emergency.locationMapsUrl}` : "";
  sendPushToUser(
    input.userId,
    {
      title: "Emergencia asignada",
      body: `${emergency.title}: ${emergency.description}${locationSuffix}`,
      url: "/emergencies/mine",
    },
    { urgency: "high" },
  ).catch((error) => {
    console.error(`No se pudo notificar al trabajador ${input.userId} de la emergencia ${emergencyId}:`, error);
  });

  return assignment;
}

/** Resuelve la emergencia: resolvedAt siempre se fija en este mismo paso,
 * junto con el status — nunca se setea uno sin el otro (ver comentario en
 * el schema). resolutionNote es opcional: puede resolverse sin explicar nada. */
export async function resolveEmergency(emergencyId: string, input: ResolveEmergencyInput) {
  await getEmergencyOrThrow(emergencyId);

  return prisma.emergency.update({
    where: { id: emergencyId },
    data: {
      status: EmergencyStatus.RESUELTA,
      resolvedAt: new Date(),
      resolutionNote: input.resolutionNote,
    },
    include: emergencyInclude,
  });
}
