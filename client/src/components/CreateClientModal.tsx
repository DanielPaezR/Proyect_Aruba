import { useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import type { Client } from "../types/client";

interface CreateClientModalProps {
  onCreated: (client: Client) => void;
  onClose: () => void;
}

/**
 * Portal a document.body: este modal se abre desde ClientPicker, que a su vez
 * puede estar anidado dentro de un <form> (ej. el de "Nuevo proyecto") — sin
 * portal, el <form> propio de este modal quedaria anidado dentro de otro
 * <form>, invalido en HTML y con riesgo de que el submit de uno dispare el
 * del otro.
 */
export function CreateClientModal({ onCreated, onClose }: CreateClientModalProps) {
  const { t } = useTranslation(["clients", "common"]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React hace bubbling de eventos por el arbol de React, no por el DOM —
    // aunque este form este portado a document.body (fuera del <form> que lo
    // pueda estar conteniendo, ej. el de editar proyecto), el submit igual
    // burbujea hacia ese <form> ancestro en React y dispara su propio
    // onSubmit si no se corta aca.
    event.stopPropagation();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<{ client: Client }>("/clients", {
        name,
        phone,
        email: email || undefined,
        notes: notes || undefined,
      });
      onCreated(response.data.client);
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-client-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
          <h2 id="create-client-modal-title">{t("createFormTitle", { ns: "clients" })}</h2>
          <label>
            {t("nameLabel", { ns: "clients" })}
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          </label>
          <label>
            {t("phoneLabel", { ns: "clients" })}
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label>
            {t("emailLabel", { ns: "clients" })}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {t("notesLabel", { ns: "clients" })}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("creating", { ns: "clients" }) : t("createSubmit", { ns: "clients" })}
            </button>
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
