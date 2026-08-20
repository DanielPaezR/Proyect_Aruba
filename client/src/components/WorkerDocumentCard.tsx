import { useState } from "react";
import { FileText } from "lucide-react";
import type { WorkerDocument } from "../types/workerDocument";
import { MediaLightbox } from "./MediaLightbox";
import type { LightboxMedia } from "./MediaLightbox";

interface WorkerDocumentCardProps {
  document: WorkerDocument;
  /** Ya traducido por el caller — ProfilePage.tsx y WorkerProfilePage.tsx
   * usan namespaces/keys distintos para el mismo texto ("Subido por X"). */
  uploadedByText: string;
  canDelete: boolean;
  deleteLabel: string;
  onDelete: () => void;
}

/** PDF vs imagen — usa mimeType si esta disponible (documentos subidos
 * despues de esta migracion); si no, cae a detectar la extension del
 * fileUrl (documentos sembrados antes, sin mimeType guardado). */
function inferDocumentMediaType(doc: WorkerDocument): "IMAGEN" | "PDF" {
  if (doc.mimeType === "application/pdf") {
    return "PDF";
  }
  if (doc.mimeType) {
    return "IMAGEN";
  }
  return doc.fileUrl.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGEN";
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null) {
    return null;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Una fila de la lista de documentos del trabajador: miniatura (imagen real
 * o icono grande de PDF cuando no hay preview posible) + nombre + tamaño +
 * fecha, clicable para abrir en MediaLightbox (imagen o PDF embebido) en vez
 * de descargar/abrir en pestaña nueva. */
export function WorkerDocumentCard({
  document: doc,
  uploadedByText,
  canDelete,
  deleteLabel,
  onDelete,
}: WorkerDocumentCardProps) {
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);

  const mediaType = inferDocumentMediaType(doc);
  const isPdf = mediaType === "PDF";
  const fileSizeLabel = formatFileSize(doc.fileSize);
  const uploadDateLabel = new Date(doc.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="card document-card">
      <button
        type="button"
        className="document-card__open"
        onClick={() => setLightboxMedia({ url: doc.fileUrl, mediaType, alt: doc.label })}
      >
        <span className={`document-card__thumb${isPdf ? " document-card__thumb--pdf" : ""}`}>
          {isPdf ? <FileText size={26} aria-hidden="true" /> : <img src={doc.fileUrl} alt="" />}
        </span>
        <span className="document-card__info">
          <span className="card-title">{doc.label}</span>
          <span className="card-meta">
            {uploadedByText}
            {fileSizeLabel ? ` · ${fileSizeLabel}` : ""} · {uploadDateLabel}
          </span>
        </span>
      </button>

      {canDelete && (
        <div className="card-actions">
          <button type="button" className="danger-button" onClick={onDelete}>
            {deleteLabel}
          </button>
        </div>
      )}

      <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
    </li>
  );
}
