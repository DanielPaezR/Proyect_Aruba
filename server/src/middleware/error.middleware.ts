import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(ErrorCode.ROUTE_NOT_FOUND, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ errorCode: ErrorCode.VALIDATION_ERROR, message: "Datos inválidos", details: err.flatten() });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ errorCode: err.errorCode, message: err.message });
  }

  if (err instanceof MulterError) {
    return res
      .status(400)
      .json({ errorCode: ErrorCode.UPLOAD_ERROR, message: `Error al subir el archivo: ${err.message}` });
  }

  console.error(err);
  return res.status(500).json({ errorCode: ErrorCode.INTERNAL_ERROR, message: "Error interno del servidor" });
}
