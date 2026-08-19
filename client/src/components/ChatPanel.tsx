import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useProjectChat } from "../hooks/useProjectChat";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  projectId: string;
}

/** Lista de mensajes + input para mandar uno nuevo. Reutilizado tanto en la
 * seccion de chat de ProjectDetailPage (Jefe/Supervisor) como en la vista
 * simple de chat para el Trabajador de Campo. */
export function ChatPanel({ projectId }: ChatPanelProps) {
  const { t } = useTranslation(["chat", "common"]);
  const { user } = useAuth();
  const { messages, isLoadingHistory, isConnected, error, sendMessage } = useProjectChat(projectId, t);

  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    setSendError(null);
    setIsSending(true);
    try {
      await sendMessage(trimmed);
      setContent("");
    } catch (submitError) {
      setSendError(submitError instanceof Error ? submitError.message : t("errors.generic", { ns: "common" }));
    } finally {
      setIsSending(false);
    }
  }

  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {isLoadingHistory && <p className="page-loading">{t("loading", { ns: "common" })}</p>}
        {!isLoadingHistory && messages.length === 0 && <p className="chat-empty">{t("empty", { ns: "chat" })}</p>}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message${message.sender.id === user?.id ? " chat-message--own" : ""}`}
          >
            <div className="chat-message-bubble">
              <div className="chat-message-header">
                <span className="chat-message-sender">{message.sender.name}</span>
                <span className="chat-message-time">{formatMessageTime(message.createdAt)}</span>
              </div>
              <p className="chat-message-content">{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={(event) => void handleSubmit(event)}>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("inputPlaceholder", { ns: "chat" })}
          maxLength={2000}
          disabled={!isConnected}
          aria-label={t("inputPlaceholder", { ns: "chat" })}
        />
        <button type="submit" disabled={!isConnected || isSending || !content.trim()}>
          <Send size={18} aria-hidden="true" />
          <span className="sr-only">{t("sendButton", { ns: "chat" })}</span>
        </button>
      </form>
      {sendError && (
        <p className="form-error" role="alert">
          {sendError}
        </p>
      )}
      {!isConnected && !isLoadingHistory && <p className="chat-connecting">{t("connecting", { ns: "chat" })}</p>}
    </div>
  );
}
