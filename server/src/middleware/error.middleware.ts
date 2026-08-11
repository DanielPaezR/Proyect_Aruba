import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof MulterError) {
    return res.status(400).json({ error: `Error al subir el archivo: ${err.message}` });
  }

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
}
