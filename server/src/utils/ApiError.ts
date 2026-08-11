export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = "No autenticado") {
    return new ApiError(401, message);
  }

  static forbidden(message = "No tiene permisos para esta acción") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }
}
