import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";

interface MediaFilePreviewProps {
  file: File;
}

/** Miniatura previa a la subida (imagen o video) para inputs que aceptan
 * image/*,video/* — usa un object URL local, nunca sube nada todavia. */
export function MediaFilePreview({ file }: MediaFilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isVideo = file.type.startsWith("video/");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) {
    return null;
  }

  return (
    <div className="media-thumb-wrapper">
      {isVideo ? (
        <video src={previewUrl} className="evidence-thumb" muted playsInline preload="metadata" />
      ) : (
        <img src={previewUrl} alt="" className="evidence-thumb" />
      )}
      {isVideo && (
        <span className="media-thumb-video-badge">
          <PlayCircle size={28} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
