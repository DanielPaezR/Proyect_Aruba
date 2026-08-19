import type { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { canAccessProject } from "../projects/projects.service";
import type { ListMessagesQuery } from "./chat.validators";

type AuthUser = { id: string; role: Role };

const messageInclude = {
  sender: { select: { id: true, name: true, role: true } },
} as const;

const DEFAULT_LIMIT = 50;

/** Mismo chequeo de acceso que el socket usa para autorizar el join a la sala —
 * ver projects.service.ts canAccessProject. Nunca se confia en lo que mande el
 * cliente, siempre se valida contra la DB. */
export async function ensureCanAccessProjectChat(user: AuthUser, projectId: string): Promise<void> {
  const allowed = await canAccessProject(user, projectId);
  if (!allowed) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
}

/**
 * Historial de mensajes para cargar la pantalla antes de que lleguen mensajes
 * nuevos por socket. Paginado hacia atras en el tiempo (before/limit); se
 * devuelve en orden cronologico ascendente (mas viejo primero) para pintar
 * directo en la UI.
 */
export async function listMessagesForProject(user: AuthUser, projectId: string, filters: ListMessagesQuery) {
  await ensureCanAccessProjectChat(user, projectId);

  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId,
      ...(filters.before ? { createdAt: { lt: filters.before } } : {}),
    },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? DEFAULT_LIMIT,
  });

  return messages.reverse();
}

/** Usado tanto por el handler de socket 'message:send' como, potencialmente,
 * por cualquier otro punto de entrada que necesite crear un mensaje — la
 * validacion de acceso al proyecto es responsabilidad del caller (el socket ya
 * valida el join antes de aceptar mensajes en la sala). */
export async function createMessage(senderId: string, projectId: string, content: string) {
  return prisma.chatMessage.create({
    data: { projectId, senderId, content },
    include: messageInclude,
  });
}
