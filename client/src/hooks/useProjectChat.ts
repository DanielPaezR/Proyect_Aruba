import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { io, type Socket } from "socket.io-client";
import { translateApiError, translateErrorCode } from "../api/apiError";
import { API_BASE_URL, apiClient } from "../api/client";
import { getAccessToken } from "../api/tokenStore";
import type { ChatMessage } from "../types/chat";

type Ack = { ok: true } | { ok: false; error: string };

interface UseProjectChatResult {
  messages: ChatMessage[];
  isLoadingHistory: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
}

/**
 * Chat en tiempo real de un proyecto: carga el historial por REST al montar,
 * conecta el socket, se une a la sala del proyecto y va agregando los
 * mensajes que lleguen por 'message:new'. El propio backend valida permiso
 * al unirse a la sala (Jefe/Supervisor siempre, Trabajador de Campo solo si
 * tiene una actividad asignada en el proyecto) — si el join falla, se
 * expone en `error` en vez de mensajes.
 */
export function useProjectChat(projectId: string | undefined, t: TFunction): UseProjectChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;
    setMessages([]);
    setError(null);
    setIsConnected(false);
    setIsLoadingHistory(true);

    async function loadHistory() {
      try {
        const response = await apiClient.get<{ messages: ChatMessage[] }>(`/projects/${projectId}/messages`);
        if (!cancelled) {
          setMessages(response.data.messages);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(translateApiError(t, loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }
    void loadHistory();

    const socket = io(API_BASE_URL, {
      // Funcion (no objeto fijo) para que tome el token vigente en cada
      // intento de conexion, incluido el reconnect automatico.
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    function joinRoom() {
      socket.emit("project:join", { projectId }, (ack: Ack) => {
        if (cancelled) {
          return;
        }
        if (ack.ok) {
          setIsConnected(true);
          setError(null);
        } else {
          setIsConnected(false);
          setError(translateErrorCode(t, ack.error));
        }
      });
    }

    socket.on("connect", joinRoom);
    socket.on("disconnect", () => {
      if (!cancelled) {
        setIsConnected(false);
      }
    });
    socket.on("connect_error", (err: Error) => {
      if (!cancelled) {
        setIsConnected(false);
        setError(translateErrorCode(t, err.message));
      }
    });
    socket.on("message:new", (message: ChatMessage) => {
      if (cancelled || message.projectId !== projectId) {
        return;
      }
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    });

    // Los navegadores moviles pausan/limitan WebSockets en segundo plano; al
    // volver a foreground, forzar la reconexion en vez de esperar el backoff
    // automatico (que puede tardar o haber quedado colgado).
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function sendMessage(content: string) {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error(translateErrorCode(t, "INTERNAL_ERROR"));
    }
    const ack = await new Promise<Ack>((resolve) => {
      socket.emit("message:send", { projectId, content }, resolve);
    });
    if (!ack.ok) {
      throw new Error(translateErrorCode(t, ack.error));
    }
  }

  return { messages, isLoadingHistory, isConnected, error, sendMessage };
}
