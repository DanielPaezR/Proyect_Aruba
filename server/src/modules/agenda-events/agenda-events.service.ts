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
  participants: { include: { user: { select: { id: true, name: true, photoUrl: true } } } },
} as const;

function serializeEvent<T extends { participants: { user: unknown }[] }>(event: T) {
  const { participants, ...rest } = event;
  return { ...rest, participants: participants.map((p) => p.user) };
}

async function resolveParticipantIds(participantIds: string[] | undefined) {
  const ids = Array.from(new Set(participantIds ?? []));
  if (ids.length === 0) {
    return ids;
  }

  const existing = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existing.length !== ids.length) {
    throw ApiError.badRequest(ErrorCode.AGENDA_EVENT_INVALID_PARTICIPANT, "Uno o mas participantes no existen");
  }

  return ids;
}

/**
 * Agenda compartida, pero no totalmente publica: ADMINISTRADOR/GERENTE ven
 * TODOS los eventos del rango (supervision completa, sin excepcion). Un
 * SUPERVISOR solo ve los suyos (creador) o aquellos donde quedo agregado
 * como participante — un evento sin participantes es privado para su
 * creador.
 */
export async function listAgendaEvents(user: AuthUser, from: Date, to: Date) {
  const events = await prisma.agendaEvent.findMany({
    where: {
      AND: [
        { startAt: { lte: to } },
        { OR: [{ endAt: { gte: from } }, { endAt: null, startAt: { gte: from } }] },
        ...(ADMIN_ROLES.includes(user.role)
          ? []
          : [{ OR: [{ createdById: user.id }, { participants: { some: { userId: user.id } } }] }]),
      ],
    },
    include: agendaEventInclude,
    orderBy: { startAt: "asc" },
  });

  return events.map(serializeEvent);
}

export async function createAgendaEvent(user: AuthUser, input: CreateAgendaEventInput) {
  const participantIds = await resolveParticipantIds(input.participantIds);

  const event = await prisma.agendaEvent.create({
    data: {
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      type: input.type,
      createdById: user.id,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
    include: agendaEventInclude,
  });

  return serializeEvent(event);
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

  const participantIds = await resolveParticipantIds(input.participantIds);

  const event = await prisma.$transaction(async (tx) => {
    // Reemplaza la lista completa de participantes (no un merge/agregado).
    await tx.agendaEventParticipant.deleteMany({ where: { eventId } });

    return tx.agendaEvent.update({
      where: { id: eventId },
      data: {
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        type: input.type,
        participants: { create: participantIds.map((userId) => ({ userId })) },
      },
      include: agendaEventInclude,
    });
  });

  return serializeEvent(event);
}

export async function deleteAgendaEvent(user: AuthUser, eventId: string) {
  await ensureEditAccess(user, eventId);
  await prisma.agendaEvent.delete({ where: { id: eventId } });
}
