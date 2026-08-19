import { EvidenceStatus, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { deleteImage, EVIDENCES_FOLDER, uploadImage } from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";

type AuthUser = { id: string; role: Role };

// Ver comentario equivalente en activities.service.ts: ensureActivityAccess
// no tiene authorize() a nivel de ruta, asi que el chequeo de rol tiene que
// ser explicito aca para no dejar pasar por descarte a un rol nuevo.
const MANAGERS: Role[] = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];
// GERENTE tiene el mismo acceso que ADMINISTRADOR (antiguo JEFE) en todo lo
// existente, incluido borrar la evidencia de cualquiera.
const ADMIN_ROLES: Role[] = [Role.ADMINISTRADOR, Role.GERENTE];

const evidenceInclude = {
  uploadedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

async function ensureActivityAccess(user: AuthUser, activityId: string) {
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

  return activity;
}

export async function listForActivity(user: AuthUser, activityId: string) {
  await ensureActivityAccess(user, activityId);

  return prisma.evidence.findMany({
    where: { activityId },
    include: evidenceInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Listado global para Administrador/Gerente/Supervisor: base de la cola de revisión y del dashboard. */
export async function listEvidences(filters: {
  status?: EvidenceStatus;
  projectId?: string;
  activityId?: string;
}) {
  return prisma.evidence.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.activityId ? { activityId: filters.activityId } : {}),
      ...(filters.projectId ? { activity: { projectId: filters.projectId } } : {}),
    },
    include: {
      ...evidenceInclude,
      activity: {
        select: { id: true, title: true, projectId: true, project: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadEvidence(
  user: AuthUser,
  activityId: string,
  file: Express.Multer.File,
  description?: string,
) {
  await ensureActivityAccess(user, activityId);

  const uploaded = await uploadImage(file.buffer, { folder: EVIDENCES_FOLDER });

  return prisma.evidence.create({
    data: {
      activityId,
      uploadedById: user.id,
      imageUrl: uploaded.url,
      imagePublicId: uploaded.publicId,
      description,
    },
    include: evidenceInclude,
  });
}

export async function reviewEvidence(
  reviewer: AuthUser,
  evidenceId: string,
  status: EvidenceStatus,
  reviewComment?: string,
) {
  const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId } });
  if (!evidence) {
    throw ApiError.notFound(ErrorCode.EVIDENCE_NOT_FOUND, "Evidencia no encontrada");
  }

  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      status,
      reviewComment,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
    },
    include: evidenceInclude,
  });
}

/** El autor puede borrar su evidencia solo mientras siga PENDIENTE; Administrador/Gerente pueden borrar cualquiera. */
export async function deleteEvidence(user: AuthUser, evidenceId: string) {
  const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId } });
  if (!evidence) {
    throw ApiError.notFound(ErrorCode.EVIDENCE_NOT_FOUND, "Evidencia no encontrada");
  }

  const isOwnPending = evidence.uploadedById === user.id && evidence.status === EvidenceStatus.PENDIENTE;
  if (!ADMIN_ROLES.includes(user.role) && !isOwnPending) {
    throw ApiError.forbidden(ErrorCode.EVIDENCE_DELETE_FORBIDDEN, "No puedes eliminar esta evidencia");
  }

  await prisma.evidence.delete({ where: { id: evidenceId } });

  if (evidence.imagePublicId) {
    // Best-effort: la fila ya se borro (fuente de verdad), asi que un fallo
    // limpiando Cloudinary no debe tumbar la respuesta. Evidencias sembradas
    // antes de esta migracion no tienen imagePublicId, no hay nada que borrar ahi.
    try {
      await deleteImage(evidence.imagePublicId);
    } catch (error) {
      console.error(`No se pudo borrar la imagen de Cloudinary (public_id ${evidence.imagePublicId}):`, error);
    }
  }
}
