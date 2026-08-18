import { v2 as cloudinary, type UploadApiErrorResponse, type UploadApiResponse } from "cloudinary";
import multer from "multer";
import { env } from "./env";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";

/**
 * Imagenes (evidencias fotograficas, imagenes de referencia de actividades,
 * etc.): se suben a Cloudinary, nunca a disco local. Mismo flujo en
 * desarrollo y produccion — sin branch "si es local, disco; si es prod,
 * Cloudinary" — para que ambos entornos se comporten igual. Ver README →
 * "Evidencias fotograficas" para el detalle de por que (filesystem efimero
 * en Railway).
 */
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export const EVIDENCES_FOLDER = "decs/evidences";
export const ACTIVITY_REFERENCE_IMAGES_FOLDER = "decs/activities";
export const USER_PROFILE_PHOTOS_FOLDER = "decs/profiles";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Generico: cualquier campo de imagen (evidencias, imagen de referencia de
 * actividad, etc.) pasa por el mismo multer — memoryStorage, mismo limite y
 * mismos tipos permitidos. */
export const imageUpload = multer({
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

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Sube un buffer (nunca toca disco) a Cloudinary. "folder" separa evidencias
 * de imagenes de referencia de actividades (u otro tipo que se agregue mas
 * adelante) dentro de la misma cuenta. "publicId" fijo es solo para el seed
 * (idempotente: volver a correrlo pisa el mismo asset en vez de duplicarlo);
 * las subidas reales de usuarios usan un public_id autogenerado.
 */
export function uploadImage(buffer: Buffer, options: { folder: string; publicId?: string }): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: "image",
        ...(options.publicId ? { public_id: options.publicId, overwrite: true } : {}),
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

export async function deleteImage(publicId: string): Promise<void> {
  // invalidate: true - sin esto, destroy() borra el asset de Cloudinary pero
  // el cache del CDN puede seguir sirviendo la imagen vieja por un rato.
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

export const INVOICES_FOLDER = "decs/invoices";

const ALLOWED_INVOICE_MIME_TYPES = new Set(["application/pdf"]);

/** Solo facturas (PDF) — multer/fileFilter separado del de imagenes para no
 * abrir PDF en evidencias/perfil/actividades, que siguen siendo solo imagen. */
export const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_INVOICE_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, ErrorCode.UNSUPPORTED_FILE_TYPE, "Formato de archivo no soportado (usa PDF)"));
      return;
    }
    cb(null, true);
  },
});

/** Sube un PDF a Cloudinary como resource_type "raw" (no es una imagen que
 * Cloudinary deba procesar/transformar, solo un archivo que se sirve tal cual). */
export function uploadInvoiceFile(buffer: Buffer): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: INVOICES_FOLDER, resource_type: "raw" },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary no devolvió resultado al subir la factura"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteInvoiceFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
}
