import { ActivityStatus, EvidenceStatus, MediaType, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  ACTIVITY_REFERENCE_IMAGES_FOLDER,
  deleteImage,
  ensureMediaWithinSizeLimit,
  isVideoMimeType,
  uploadImage,
} from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { sendPushToUser } from "../../utils/push";
import type { CreateActivityInput, SkipActivityInput, UpdateActivityInput } from "./activities.validators";

type AuthUser = { id: string; role: Role };

// Usado para los chequeos de permiso explicitos de este archivo (ver
// updateActivityStatus/skipActivity) — no confundir con el MANAGERS de
// activities.routes.ts, que gatea rutas enteras; este es a nivel de service,
// para las dos rutas que no tienen authorize() y dependen de logica interna.
const MANAGERS: Role[] = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

const activityInclude = {
  assignments: { include: { user: { select: { id: true, name: true } } } },
  skippedBy: { select: { id: true, name: true } },
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
    // Programadas primero (mas cercana primero), sin fecha al final.
    orderBy: { scheduledDate: { sort: "asc", nulls: "last" } },
  });
}

export async function listMyActivities(userId: string, filters: { status?: ActivityStatus }) {
  return prisma.activity.findMany({
    where: {
      assignments: { some: { userId } },
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      ...activityInclude,
      project: { select: { id: true, name: true, address: true, mapsUrl: true, workType: true } },
    },
    orderBy: { scheduledDate: { sort: "asc", nulls: "last" } },
  });
}

/**
 * Actividades programadas en un rango de fechas, sin importar el proyecto —
 * usado para combinar con AgendaEvent en la vista de agenda de
 * Administrador/Gerente/Supervisor (ver agenda-events.service.ts). Solo esos
 * roles llegan aca (gateado en activities.routes.ts), asi que no hace falta
 * visibilityWhere.
 */
export async function listScheduledActivities(from: Date, to: Date) {
  return prisma.activity.findMany({
    where: { scheduledDate: { gte: from, lte: to } },
    include: {
      ...activityInclude,
      project: { select: { id: true, name: true } },
    },
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

export async function createActivity(
  projectId: string,
  input: CreateActivityInput,
  referenceImage?: Express.Multer.File,
) {
  await ensureProjectExists(projectId);

  if (input.assignedUserIds?.length) {
    await ensureUsersAreFieldWorkers(input.assignedUserIds);
  }

  let referenceImageUrl: string | undefined;
  let referenceImagePublicId: string | undefined;
  let referenceMediaType: MediaType | undefined;
  if (referenceImage) {
    ensureMediaWithinSizeLimit(referenceImage);
    const isVideo = isVideoMimeType(referenceImage.mimetype);
    const uploaded = await uploadImage(referenceImage.buffer, {
      folder: ACTIVITY_REFERENCE_IMAGES_FOLDER,
      resourceType: isVideo ? "video" : "image",
    });
    referenceImageUrl = uploaded.url;
    referenceImagePublicId = uploaded.publicId;
    referenceMediaType = isVideo ? MediaType.VIDEO : MediaType.IMAGEN;
  }

  return prisma.activity.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      scheduledDate: input.scheduledDate,
      referenceImageUrl,
      referenceImagePublicId,
      referenceMediaType,
      assignments: input.assignedUserIds?.length
        ? { create: input.assignedUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: activityInclude,
  });
}

export async function updateActivity(
  activityId: string,
  input: UpdateActivityInput,
  referenceImage?: Express.Multer.File,
) {
  const existing = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.ACTIVITY_NOT_FOUND, "Actividad no encontrada");
  }

  let imageFields: {
    referenceImageUrl?: string;
    referenceImagePublicId?: string;
    referenceMediaType?: MediaType;
  } = {};
  if (referenceImage) {
    ensureMediaWithinSizeLimit(referenceImage);
    const isVideo = isVideoMimeType(referenceImage.mimetype);
    const uploaded = await uploadImage(referenceImage.buffer, {
      folder: ACTIVITY_REFERENCE_IMAGES_FOLDER,
      resourceType: isVideo ? "video" : "image",
    });
    imageFields = {
      referenceImageUrl: uploaded.url,
      referenceImagePublicId: uploaded.publicId,
      referenceMediaType: isVideo ? MediaType.VIDEO : MediaType.IMAGEN,
    };

    if (existing.referenceImagePublicId) {
      // Best-effort, mismo patron que evidences.service.ts: la fila ya se va
      // a actualizar igual, un fallo limpiando la imagen vieja de Cloudinary
      // no debe tumbar la respuesta.
      try {
        await deleteImage(existing.referenceImagePublicId, existing.referenceMediaType === MediaType.VIDEO ? "video" : "image");
      } catch (error) {
        console.error(
          `No se pudo borrar la imagen de referencia anterior (public_id ${existing.referenceImagePublicId}):`,
          error,
        );
      }
    }
  }

  // Reprogramar una actividad OMITIDA (darle una fecha nueva) la vuelve a
  // PENDIENTE automaticamente — es la unica forma de "reprogramar" que pide
  // el flujo, no hace falta un cambio de estado aparte.
  const unskipFields =
    existing.status === ActivityStatus.OMITIDA && input.scheduledDate ? { status: ActivityStatus.PENDIENTE } : {};

  return prisma.activity.update({
    where: { id: activityId },
    data: { ...input, ...imageFields, ...unskipFields },
    include: activityInclude,
  });
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
  } else if (!MANAGERS.includes(user.role)) {
    // Permiso explicito, no "todo lo que no es trabajador esta permitido":
    // un rol nuevo sin necesidad definida aca (ej. MERCADERISTA) no debe
    // heredar acceso de gestion de actividades por descarte.
    throw ApiError.forbidden();
  }

  // Regla de integridad de datos, no de permisos: aplica a todos los roles
  // por igual, incluido Administrador/Gerente/Supervisor — no se puede dar por completada una
  // actividad sin evidencia que respalde que efectivamente se hizo.
  if (status === ActivityStatus.COMPLETADA) {
    const approvedEvidenceCount = await prisma.evidence.count({
      where: { activityId, status: EvidenceStatus.APROBADA },
    });
    if (approvedEvidenceCount === 0) {
      throw ApiError.badRequest(
        ErrorCode.ACTIVITY_MISSING_APPROVED_EVIDENCE,
        "No se puede marcar como completada: necesita al menos una evidencia aprobada",
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

const SKIPPABLE_STATUSES: ActivityStatus[] = [ActivityStatus.PENDIENTE, ActivityStatus.EN_PROGRESO];

/**
 * Omitir: el trabajador asignado (o Administrador/Gerente/Supervisor) marca
 * que una actividad no se pudo hacer y por que, para que se reprograme —
 * distinto de cancelarla, que implica que ya no hace falta. Notifica por
 * push a todo Administrador/Gerente/Supervisor (no hay un "supervisor a
 * cargo" de un proyecto puntual en el modelo actual, la gestion es
 * compartida entre todos).
 */
export async function skipActivity(user: AuthUser, activityId: string, input: SkipActivityInput) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { assignments: true, project: { select: { id: true, name: true } } },
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

  if (!SKIPPABLE_STATUSES.includes(activity.status)) {
    throw ApiError.forbidden(
      ErrorCode.INVALID_STATUS_TRANSITION,
      "Solo se puede omitir una actividad pendiente o en progreso",
    );
  }

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      status: ActivityStatus.OMITIDA,
      skipReason: input.reason,
      skippedAt: new Date(),
      skippedById: user.id,
    },
    include: activityInclude,
  });

  await notifyManagersOfSkippedActivity(activity.title, activity.project.name, input.reason);

  return updated;
}

async function notifyManagersOfSkippedActivity(activityTitle: string, projectName: string, reason: string) {
  const managers = await prisma.user.findMany({
    where: { role: { in: [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR] }, isActive: true },
    select: { id: true },
  });

  await Promise.all(
    managers.map((manager) =>
      sendPushToUser(manager.id, {
        title: "Actividad omitida",
        body: `"${activityTitle}" (${projectName}) fue omitida: ${reason}`,
      }).catch((error) => {
        console.error(`No se pudo notificar al usuario ${manager.id} de la actividad omitida:`, error);
      }),
    ),
  );
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
