import { Role, type ProjectStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateProjectInput, UpdateProjectInput } from "./projects.validators";

type AuthUser = { id: string; role: Role };

/** Un Trabajador de Campo solo ve proyectos donde tiene alguna actividad asignada. */
export function visibilityWhere(user: AuthUser) {
  if (user.role === Role.TRABAJADOR_CAMPO) {
    return { activities: { some: { assignments: { some: { userId: user.id } } } } };
  }
  return {};
}

/** Mismo criterio que visibilityWhere, para lugares que solo necesitan un booleano
 * (ej. autorizar unirse a la sala de chat de un proyecto). Administrador/Gerente/
 * Supervisor siempre pueden; Trabajador de Campo solo si tiene alguna actividad
 * asignada en el proyecto — se valida contra la DB, nunca confiando en lo que
 * mande el cliente. */
export async function canAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...visibilityWhere(user) },
    select: { id: true },
  });
  return project !== null;
}

export async function listProjects(user: AuthUser, filters: { status?: ProjectStatus }) {
  return prisma.project.findMany({
    where: {
      ...visibilityWhere(user),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: { _count: { select: { activities: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(user: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...visibilityWhere(user) },
    include: {
      createdBy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, phone: true, email: true } },
      activities: {
        // Programadas primero (mas cercana primero), sin fecha al final.
        orderBy: { scheduledDate: { sort: "asc", nulls: "last" } },
        include: {
          assignments: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { evidences: true } },
        },
      },
    },
  });

  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }

  return project;
}

export async function createProject(creatorId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: { ...input, createdById: creatorId },
  });
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  await ensureProjectExists(projectId);
  return prisma.project.update({ where: { id: projectId }, data: input });
}

export async function deleteProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { activities: true } } },
  });

  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }

  if (project._count.activities > 0) {
    throw ApiError.conflict(
      ErrorCode.PROJECT_HAS_ACTIVITIES,
      "No se puede eliminar un proyecto con actividades. Cambia su estado a CANCELADO en su lugar.",
    );
  }

  await prisma.project.delete({ where: { id: projectId } });
}

async function ensureProjectExists(projectId: string) {
  const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
}
