import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { sendPushToUser } from "../../utils/push";
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

/** Mismo criterio de acceso que canAccessProject (Administrador/Gerente/
 * Supervisor siempre, Trabajador de Campo solo si tiene una actividad
 * asignada en el proyecto), pero devolviendo la lista completa de ids en vez
 * de un booleano para un usuario puntual — se usa para decidir a quien
 * mandarle push cuando llega un mensaje nuevo. */
export async function getProjectChatRecipientIds(projectId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR] } },
        { role: Role.TRABAJADOR_CAMPO, activityAssignments: { some: { activity: { projectId } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

/** Marca el chat de un proyecto como leido para un usuario (upsert por
 * userId+projectId) — se llama al unirse a la sala de Socket.IO de ese
 * proyecto (abrir el chat) y para cada usuario ya conectado a la sala cuando
 * llega un mensaje nuevo (lo ve en vivo, no queda como no leido). */
export async function markProjectChatRead(userId: string, projectId: string): Promise<void> {
  await prisma.chatReadState.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: { lastReadAt: new Date() },
    create: { userId, projectId },
  });
}

const PUSH_PREVIEW_MAX_LENGTH = 80;

/** Corta el contenido del mensaje para la notificacion push sin partir una
 * palabra a la mitad cuando es razonable (busca el ultimo espacio dentro del
 * limite; si no hay uno util, corta tal cual). */
function truncateForPush(content: string): string {
  if (content.length <= PUSH_PREVIEW_MAX_LENGTH) {
    return content;
  }
  const cut = content.slice(0, PUSH_PREVIEW_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trim()}…`;
}

/** Push best-effort a los destinatarios que no estan viendo el chat en vivo
 * ahora mismo (ver chat.gateway.ts, que calcula recipientIds excluyendo a
 * quien ya esta conectado a la sala del proyecto). Un fallo en un usuario no
 * debe afectar a los demas ni al flujo de 'message:send'. */
export async function notifyProjectChatMessage(
  message: Awaited<ReturnType<typeof createMessage>>,
  projectId: string,
  recipientIds: string[],
): Promise<void> {
  if (recipientIds.length === 0) {
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) {
    return;
  }

  const body = `${message.sender.name} — ${truncateForPush(message.content)}`;

  await Promise.all(
    recipientIds.map((userId) =>
      sendPushToUser(userId, {
        title: project.name,
        body,
        url: `/projects/${projectId}/chat`,
      }).catch((error) => {
        console.error(`No se pudo notificar al usuario ${userId} del mensaje de chat nuevo:`, error);
      }),
    ),
  );
}
