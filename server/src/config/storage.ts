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
export const VEHICLE_INCIDENT_PHOTOS_FOLDER = "decs/vehicle-incidents";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Generico: cualquier campo de SOLO imagen (foto de perfil, foto de
 * incidente de vehiculo, etc.) pasa por el mismo multer — memoryStorage,
 * mismo limite y mismos tipos permitidos. Evidencias e imagen de referencia
 * de actividad usan mediaUpload (abajo), que ademas acepta video. */
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

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ALLOWED_MEDIA_MIME_TYPES = new Set([...ALLOWED_MIME_TYPES, ...VIDEO_MIME_TYPES]);

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export function isVideoMimeType(mimetype: string): boolean {
  return VIDEO_MIME_TYPES.has(mimetype);
}

/** Evidencias e imagen de referencia de actividad: imagen O video (MP4,
 * QuickTime/MOV) — a diferencia de imageUpload, que se mantiene solo-imagen
 * para el resto de subidas. El limite de multer usa el maximo (video,
 * 50MB); el limite mas chico de imagen (8MB) se valida aparte con
 * ensureMediaWithinSizeLimit, porque multer no soporta un limite
 * condicional por mimetype en un solo middleware. */
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
      cb(
        new ApiError(
          400,
          ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          "Formato no soportado (usa JPEG, PNG, WEBP, MP4 o MOV)",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

/** Si el archivo que paso el fileFilter de mediaUpload es una imagen (no
 * video), reaplica el limite de 8MB que multer no pudo aplicar solo (ver
 * comentario de mediaUpload). Se llama despues de multer, antes de subir a
 * Cloudinary. */
export function ensureMediaWithinSizeLimit(file: Express.Multer.File): void {
  if (!isVideoMimeType(file.mimetype) && file.buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ApiError(400, ErrorCode.UPLOAD_ERROR, "La imagen no puede pesar más de 8MB");
  }
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Sube un buffer (nunca toca disco) a Cloudinary. "folder" separa evidencias
 * de imagenes de referencia de actividades (u otro tipo que se agregue mas
 * adelante) dentro de la misma cuenta. "publicId" fijo es solo para el seed
 * (idempotente: volver a correrlo pisa el mismo asset en vez de duplicarlo);
 * las subidas reales de usuarios usan un public_id autogenerado. "resourceType"
 * default "image" (todos los llamadores existentes); evidencias/referencia de
 * actividad lo pasan explicito segun el mimetype recibido (ver isVideoMimeType).
 */
export function uploadImage(
  buffer: Buffer,
  options: { folder: string; publicId?: string; resourceType?: "image" | "video" },
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType ?? "image",
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

/** resourceType default "image" (todos los llamadores existentes, que solo
 * manejan fotos); evidencias/referencia de actividad lo pasan explicito
 * segun el mediaType guardado — Cloudinary no encuentra el asset para
 * destruirlo si el resource_type no coincide con el que se uso al subirlo. */
export async function deleteImage(publicId: string, resourceType: "image" | "video" = "image"): Promise<void> {
  // invalidate: true - sin esto, destroy() borra el asset de Cloudinary pero
  // el cache del CDN puede seguir sirviendo la imagen vieja por un rato.
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
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
 * Cloudinary deba procesar/transformar, solo un archivo que se sirve tal
 * cual). format: "pdf" es obligatorio aca — sin el, Cloudinary no sabe que
 * tipo de archivo es (el buffer no lleva nombre) y lo sirve como
 * application/octet-stream con Content-Disposition: attachment, forzando
 * descarga en vez de poder mostrarlo embebido (ver mismo comentario en
 * uploadDocumentFile/DOCUMENT_MIME_TO_FORMAT — invoiceUpload ya valida PDF
 * unicamente, no hace falta un mapa de mimetype a formato). */
export function uploadInvoiceFile(buffer: Buffer): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: INVOICES_FOLDER, resource_type: "raw", format: "pdf" },
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

export const WORKER_DOCUMENTS_FOLDER = "decs/worker-documents";

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Documentos del trabajador (cedula, certificados...): imagen escaneada O
 * PDF, a diferencia de imageUpload (solo imagen) e invoiceUpload (solo PDF). */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, ErrorCode.UNSUPPORTED_FILE_TYPE, "Formato de archivo no soportado (usa JPEG, PNG, WEBP o PDF)"));
      return;
    }
    cb(null, true);
  },
});

export interface UploadedDocumentFile extends UploadedImage {
  /** Tamaño en bytes, tal como lo devuelve Cloudinary — se persiste en
   * WorkerDocument.fileSize (ver auth.service.ts uploadWorkerDocument). */
  bytes: number;
}

/** Subir un Buffer "pelado" (sin nombre de archivo) a un resource_type "raw"
 * sin indicar "format" hace que Cloudinary no sepa que tipo de archivo es:
 * lo sirve como application/octet-stream con Content-Disposition: attachment
 * (fuerza descarga), lo que rompe mostrarlo en un <iframe>. Mapear el
 * mimetype a la extension esperada por Cloudinary evita eso — con format
 * seteado, sirve el Content-Type correcto y lo deja embeber inline. */
const DOCUMENT_MIME_TO_FORMAT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Sube como resource_type "raw" (igual que las facturas): no es una imagen
 * que Cloudinary deba transformar, solo un archivo que se sirve tal cual —
 * mismo tratamiento para la foto escaneada de una cedula que para un PDF.
 * "mimetype" (de Express.Multer.File) fija el "format" de Cloudinary para
 * que la URL resultante sirva el Content-Type correcto (ver comentario de
 * DOCUMENT_MIME_TO_FORMAT). */
export function uploadDocumentFile(buffer: Buffer, mimetype: string): Promise<UploadedDocumentFile> {
  return new Promise((resolve, reject) => {
    const format = DOCUMENT_MIME_TO_FORMAT[mimetype];
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: WORKER_DOCUMENTS_FOLDER, resource_type: "raw", ...(format ? { format } : {}) },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary no devolvió resultado al subir el documento"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id, bytes: result.bytes });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteDocumentFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
}
