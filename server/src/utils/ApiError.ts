import { ErrorCode } from "./errorCodes";

export class ApiError extends Error {
  statusCode: number;
  errorCode: ErrorCode;

  constructor(statusCode: number, errorCode: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = "ApiError";
  }

  static badRequest(errorCode: ErrorCode, message: string) {
    return new ApiError(400, errorCode, message);
  }

  static unauthorized(errorCode: ErrorCode = ErrorCode.UNAUTHENTICATED, message = "No autenticado") {
    return new ApiError(401, errorCode, message);
  }

  static forbidden(errorCode: ErrorCode = ErrorCode.FORBIDDEN_ROLE, message = "No tiene permisos para esta acción") {
    return new ApiError(403, errorCode, message);
  }

  static notFound(errorCode: ErrorCode, message = "Recurso no encontrado") {
    return new ApiError(404, errorCode, message);
  }

  static conflict(errorCode: ErrorCode, message: string) {
    return new ApiError(409, errorCode, message);
  }
}
