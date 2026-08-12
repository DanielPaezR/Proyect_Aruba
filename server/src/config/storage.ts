import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";

/**
 * ADVERTENCIA — almacenamiento en disco local, NO apto para producción en Railway tal cual:
 *
 * Railway (y la mayoría de PaaS sin servidor persistente) usan un filesystem
 * efímero: cada despliegue, reinicio o escalado horizontal parte de una imagen
 * limpia y borra cualquier archivo escrito en runtime. Si subes evidencias
 * reales sin más configuración, se van a perder en el próximo deploy.
 *
 * Antes de usar esto en producción, hay dos opciones:
 *   1. Montar un Railway Volume en /app/uploads (persiste entre deploys, pero
 *      no entre réplicas si escalas horizontalmente). Ver README → "Despliegue
 *      en Railway".
 *   2. Migrar este módulo a almacenamiento externo tipo S3/Cloudflare R2
 *      (recomendado a mediano plazo; el resto de la app no se ve afectado
 *      porque Evidence.imageUrl ya es solo un string).
 *
 * No implementado todavía — esto es solo la advertencia documentada.
 */
export const UPLOADS_DIR = path.join(process.cwd(), "uploads", "evidences");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

export const evidenceUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(
        new ApiError(
          400,
          ErrorCode.UNSUPPORTED_IMAGE_TYPE,
          "Formato de imagen no soportado (usa JPEG, PNG o WEBP)",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

export function evidenceFileUrl(filename: string): string {
  return `/uploads/evidences/${filename}`;
}

export function deleteEvidenceFile(imageUrl: string) {
  const filePath = path.join(UPLOADS_DIR, path.basename(imageUrl));
  fs.rm(filePath, { force: true }, () => undefined);
}
