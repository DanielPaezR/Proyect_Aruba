import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface BackButtonProps {
  /** Ruta fija del "padre" de esta pantalla. Si se omite, usa navigate(-1)
   * (volver a lo que sea que haya en el historial del navegador). */
  to?: string;
  /** Texto a mostrar — por defecto el genérico "Atrás" (t("actions.back")). */
  label?: string;
}

export function BackButton({ to, label }: BackButtonProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  function handleClick() {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  }

  return (
    <button type="button" className="back-button" onClick={handleClick}>
      <ChevronLeft size={18} aria-hidden="true" />
      <span>{label ?? t("actions.back")}</span>
    </button>
  );
}
