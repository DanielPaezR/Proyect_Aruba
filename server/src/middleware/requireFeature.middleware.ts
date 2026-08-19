import type { NextFunction, Request, Response } from "express";
import { Feature, Role } from "@prisma/client";
import { hasFeatureAccess } from "../modules/permissions/permissions.service";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * "Portón" por seccion: decide si el usuario entra a la seccion en
 * absoluto, separado de los permisos finos que cada authorize()/service ya
 * deciden una vez adentro (esos no se tocan — este middleware va ANTES).
 * Nunca aplica a TRABAJADOR_CAMPO: esas rutas suelen mezclar autoservicio
 * (ej. "mis herramientas", "mi documento") con la gestion de la seccion, y
 * esta capa es solo para gestion — el trabajador siempre pasa de largo.
 * Debe usarse despues de authenticate.
 */
export function requireFeature(feature: Feature) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (req.user.role === Role.TRABAJADOR_CAMPO) {
      next();
      return;
    }

    const allowed = await hasFeatureAccess(req.user.id, req.user.role, feature);
    if (!allowed) {
      throw ApiError.forbidden(ErrorCode.FEATURE_ACCESS_DENIED, "No tienes acceso a esta sección");
    }

    next();
  });
}
