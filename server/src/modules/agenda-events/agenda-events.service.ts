import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateAgendaEventInput, UpdateAgendaEventInput } from "./agenda-events.validators";

type AuthUser = { id: string; role: Role };

// GERENTE tiene el mismo acceso que ADMINISTRADOR (antiguo JEFE) en todo lo
// existente, incluida la edicion/borrado de un evento ajeno.
const ADMIN_ROLES: Role[] = [Role.ADMINISTRADOR, Role.GERENTE];

const agendaEventInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

/**
 * Agenda compartida: cualquier Administrador/Gerente/Supervisor autenticado
 * ve TODOS los eventos del rango, no solo los suyos — no es una agenda
 * personal.
 */
export async function listAgendaEvents(from: Date, to: Date) {
  return prisma.agendaEvent.findMany({
    where: {
      startAt: { lte: to },
      OR: [{ endAt: { gte: from } }, { endAt: null, startAt: { gte: from } }],
    },
    include: agendaEventInclude,
    orderBy: { startAt: "asc" },
  });
}

export async function createAgendaEvent(user: AuthUser, input: CreateAgendaEventInput) {
  return prisma.agendaEvent.create({
    data: {
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      type: input.type,
      createdById: user.id,
    },
    include: agendaEventInclude,
  });
}

async function ensureEditAccess(user: AuthUser, eventId: string) {
  const event = await prisma.agendaEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw ApiError.notFound(ErrorCode.AGENDA_EVENT_NOT_FOUND, "Evento no encontrado");
  }

  if (!ADMIN_ROLES.includes(user.role) && event.createdById !== user.id) {
    throw ApiError.forbidden(ErrorCode.AGENDA_EVENT_EDIT_FORBIDDEN, "No puedes editar este evento");
  }

  return event;
}

export async function updateAgendaEvent(user: AuthUser, eventId: string, input: UpdateAgendaEventInput) {
  const existing = await ensureEditAccess(user, eventId);

  const nextStartAt = input.startAt ?? existing.startAt;
  const nextEndAt = input.endAt === undefined ? existing.endAt : input.endAt;
  if (nextEndAt && nextEndAt < nextStartAt) {
    throw ApiError.badRequest(ErrorCode.AGENDA_EVENT_END_BEFORE_START, "endAt no puede ser anterior a startAt");
  }

  return prisma.agendaEvent.update({
    where: { id: eventId },
    data: {
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      type: input.type,
    },
    include: agendaEventInclude,
  });
}

export async function deleteAgendaEvent(user: AuthUser, eventId: string) {
  await ensureEditAccess(user, eventId);
  await prisma.agendaEvent.delete({ where: { id: eventId } });
}
