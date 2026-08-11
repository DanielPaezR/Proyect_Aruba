import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

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
      cb(new ApiError(400, "Formato de imagen no soportado (usa JPEG, PNG o WEBP)"));
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
