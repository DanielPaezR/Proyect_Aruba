import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export interface LightboxMedia {
  url: string;
  /** null/undefined = archivo sembrado antes de la migracion de MediaType — se trata como IMAGEN.
   * "PDF" es propio de documentos del trabajador (WorkerDocument), no del enum MediaType de Evidence/Activity. */
  mediaType?: "IMAGEN" | "VIDEO" | "PDF" | null;
  alt?: string;
}

interface MediaLightboxProps {
  media: LightboxMedia | null;
  onClose: () => void;
}

/**
 * Portal a document.body (mismo patron que CreateClientModal): se abre desde
 * miniaturas anidadas en tarjetas/formularios, y no debe quedar atrapado por
 * el overflow o z-index de su contenedor.
 */
export function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!media) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [media, onClose]);

  if (!media) {
    return null;
  }

  const isVideo = media.mediaType === "VIDEO";
  const isPdf = media.mediaType === "PDF";

  return createPortal(
    <div className="media-lightbox-backdrop" role="presentation" onClick={onClose}>
      <button
        type="button"
        className="media-lightbox-close"
        onClick={onClose}
        aria-label={t("mediaLightbox.close")}
      >
        <X size={28} aria-hidden="true" />
      </button>
      <div
        className="media-lightbox-content"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {isVideo ? (
          <video src={media.url} controls autoPlay className="media-lightbox-media" />
        ) : isPdf ? (
          <iframe src={media.url} className="media-lightbox-pdf" title={media.alt || t("mediaLightbox.pdfTitle")} />
        ) : (
          <img src={media.url} alt={media.alt ?? ""} className="media-lightbox-media" />
        )}
      </div>
    </div>,
    document.body,
  );
}
