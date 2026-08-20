import { PlayCircle } from "lucide-react";
import type { MediaType } from "../types/media";

interface MediaThumbProps {
  url: string;
  /** null/undefined = archivo sembrado antes de la migracion de MediaType — se trata como IMAGEN. */
  mediaType?: MediaType | null;
  alt?: string;
  className?: string;
  onClick: () => void;
}

/** Miniatura clicable (imagen o video) que abre MediaLightbox — un <img> no
 * puede mostrar un archivo de video, asi que un video usa <video> sin
 * controles (solo el primer cuadro) con un icono de play superpuesto. */
export function MediaThumb({ url, mediaType, alt, className, onClick }: MediaThumbProps) {
  const isVideo = mediaType === "VIDEO";
  const thumbClassName = className ?? "evidence-thumb";

  return (
    <button type="button" className="media-thumb-button" onClick={onClick}>
      {isVideo ? (
        <video src={url} className={thumbClassName} muted playsInline preload="metadata" />
      ) : (
        <img src={url} alt={alt ?? ""} className={thumbClassName} />
      )}
      {isVideo && (
        <span className="media-thumb-video-badge">
          <PlayCircle size={28} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
