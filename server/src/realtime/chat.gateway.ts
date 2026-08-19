import type { Server as HttpServer } from "node:http";
import type { Role } from "@prisma/client";
import { Server, type DefaultEventsMap, type Socket } from "socket.io";
import { env } from "../config/env";
import { canAccessProject } from "../modules/projects/projects.service";
import * as chatService from "../modules/chat/chat.service";
import { sendMessageSchema } from "../modules/chat/chat.validators";
import { ErrorCode } from "../utils/errorCodes";
import { verifyAccessToken } from "../utils/jwt";

type AuthUser = { id: string; role: Role };
type Ack = (response: { ok: true } | { ok: false; error: string }) => void;
type ChatMessage = Awaited<ReturnType<typeof chatService.createMessage>>;

interface ClientToServerEvents {
  "project:join": (payload: { projectId: string }, ack?: Ack) => void;
  "message:send": (payload: { projectId: string; content: string }, ack?: Ack) => void;
}

interface ServerToClientEvents {
  "message:new": (message: ChatMessage) => void;
}

interface SocketData {
  user: AuthUser;
}

function roomName(projectId: string): string {
  return `project:${projectId}`;
}

/**
 * Chat en tiempo real por proyecto. Corre sobre el mismo servidor HTTP de
 * Express (Railway lo soporta sin configuracion especial al ser un proceso
 * persistente, no serverless) — no un servicio aparte.
 */
export function attachChatGateway(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  // Autenticacion al conectar: mismo jwt.verify (via verifyAccessToken) que ya
  // usa el middleware HTTP. Rechaza la conexion si el token falta o no es valido.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error(ErrorCode.MISSING_TOKEN));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error(ErrorCode.INVALID_TOKEN));
    }
  });

  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>) => {
    socket.on("project:join", (payload, ack) => {
      void handleJoin(socket, payload?.projectId, ack);
    });

    socket.on("message:send", (payload, ack) => {
      void handleMessageSend(io, socket, payload, ack);
    });
  });

  return io;
}

async function handleJoin(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>,
  projectId: string | undefined,
  ack?: Ack,
) {
  if (!projectId) {
    ack?.({ ok: false, error: ErrorCode.VALIDATION_ERROR });
    return;
  }

  try {
    // Valida contra la DB, nunca confiando en lo que mande el cliente: Jefe/
    // Supervisor siempre pueden, Trabajador de Campo solo si tiene alguna
    // actividad asignada en ese proyecto.
    const allowed = await canAccessProject(socket.data.user, projectId);
    if (!allowed) {
      ack?.({ ok: false, error: ErrorCode.FORBIDDEN_ROLE });
      return;
    }

    await socket.join(roomName(projectId));
    ack?.({ ok: true });
  } catch (error) {
    console.error(`Error al unirse a la sala de chat del proyecto ${projectId}:`, error);
    ack?.({ ok: false, error: ErrorCode.INTERNAL_ERROR });
  }
}

async function handleMessageSend(
  io: Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>,
  payload: { projectId: string; content: string } | undefined,
  ack?: Ack,
) {
  const projectId = payload?.projectId;
  if (!projectId) {
    ack?.({ ok: false, error: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const room = roomName(projectId);
  // El permiso ya se valido al hacer join: si el socket no esta en la sala,
  // no se le deja mandar mensajes ahi (evita que mande projectId arbitrarios
  // sin haber pasado por el chequeo de acceso).
  if (!socket.rooms.has(room)) {
    ack?.({ ok: false, error: ErrorCode.FORBIDDEN_ROLE });
    return;
  }

  const parsed = sendMessageSchema.safeParse({ content: payload?.content });
  if (!parsed.success) {
    ack?.({ ok: false, error: ErrorCode.VALIDATION_ERROR });
    return;
  }

  try {
    const message = await chatService.createMessage(socket.data.user.id, projectId, parsed.data.content);
    // Se emite tambien al propio remitente (no socket.to), para que su UI se
    // actualice por el mismo canal que todos los demas.
    io.to(room).emit("message:new", message);
    ack?.({ ok: true });
  } catch (error) {
    console.error(`Error al enviar mensaje de chat al proyecto ${projectId}:`, error);
    ack?.({ ok: false, error: ErrorCode.INTERNAL_ERROR });
  }
}
