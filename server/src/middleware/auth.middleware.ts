import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { ErrorCode } from "../utils/errorCodes";
import { verifyAccessToken } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

/** Verifica el access token (Bearer) y adjunta req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized(ErrorCode.MISSING_TOKEN, "Falta el token de autenticación");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw ApiError.unauthorized(ErrorCode.INVALID_TOKEN, "Token inválido o expirado");
  }
}

/** Restringe el acceso a los roles indicados. Debe usarse después de authenticate. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden();
    }

    next();
  };
}

/**
 * Gestión de inventario (herramientas/materiales) — separado a propósito de
 * MANAGERS/isManagerRole: ADMINISTRADOR/GERENTE/SUPERVISOR gestionan
 * proyectos, MERCADERISTA gestiona inventario; ADMINISTRADOR/GERENTE tienen
 * acceso de escritura ademas por su rol de autoridad general (mismo patron
 * que evidencias/facturas), SUPERVISOR no. SUPERVISOR y TRABAJADOR_CAMPO
 * igual pueden LEER el catálogo (para saber qué existe al pedir materiales)
 * — eso se gatea aparte con authenticate a secas, sin este guard.
 */
export const INVENTORY_ROLES: Role[] = [Role.MERCADERISTA, Role.ADMINISTRADOR, Role.GERENTE];

export function isInventoryRole(role: Role): boolean {
  return INVENTORY_ROLES.includes(role);
}
