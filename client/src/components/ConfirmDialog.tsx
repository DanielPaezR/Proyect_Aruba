import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  isConfirming?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Contenido extra entre el mensaje y las acciones (ej. un campo de nueva
   * contraseña para "Restablecer contraseña") — opcional, la mayoria de usos
   * son de solo confirmar/cancelar sin nada mas. */
  children?: ReactNode;
}

/** Modal generico de confirmacion para acciones destructivas (borrar proyecto,
 * actividad, etc). Nunca se dispara la accion desde un solo click en la lista —
 * siempre pasa por aca primero. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  isConfirming = false,
  error,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>

        {children}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={isConfirming}>
            {t("actions.cancel")}
          </button>
          <button type="button" className="modal-button--danger" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? t("actions.deleting") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
