import { v2 as cloudinary, type UploadApiErrorResponse, type UploadApiResponse } from "cloudinary";
import multer from "multer";
import { env } from "./env";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";

/**
 * Evidencias fotograficas: se suben a Cloudinary, nunca a disco local. Mismo
 * flujo en desarrollo y produccion — sin branch "si es local, disco; si es
 * prod, Cloudinary" — para que ambos entornos se comporten igual. Ver README
 * → "Evidencias fotograficas" para el detalle de por que (filesystem efimero
 * en Railway).
 */
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

const EVIDENCES_FOLDER = "decs/evidences";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
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

export interface UploadedEvidenceImage {
  url: string;
  publicId: string;
}

/**
 * Sube un buffer (nunca toca disco) a Cloudinary. "publicId" fijo es solo
 * para el seed (idempotente: volver a correrlo pisa el mismo asset en vez de
 * duplicarlo); las subidas reales de usuarios usan un public_id autogenerado.
 */
export function uploadEvidenceImage(buffer: Buffer, options?: { publicId?: string }): Promise<UploadedEvidenceImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: EVIDENCES_FOLDER,
        resource_type: "image",
        ...(options?.publicId ? { public_id: options.publicId, overwrite: true } : {}),
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary no devolvió resultado al subir la imagen"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteEvidenceImage(publicId: string): Promise<void> {
  // invalidate: true - sin esto, destroy() borra el asset de Cloudinary pero
  // el cache del CDN puede seguir sirviendo la imagen vieja por un rato.
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}
