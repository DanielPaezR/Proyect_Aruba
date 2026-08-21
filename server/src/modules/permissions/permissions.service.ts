import { Feature, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";

const ALL_FEATURES: Feature[] = [
  Feature.USUARIOS,
  Feature.PROYECTOS,
  Feature.CLIENTES,
  Feature.INVENTARIO,
  Feature.EVIDENCIAS,
  Feature.FACTURAS,
  Feature.EMERGENCIAS,
  Feature.REPORTES,
];

/**
 * Default de acceso por rol cuando no hay override explicito en
 * UserFeatureAccess. GERENTE no esta aca a proposito: siempre tiene acceso
 * (ver hasFeatureAccess), ignora tanto este default como cualquier
 * override. TRABAJADOR_CAMPO tampoco esta: esta capa no aplica a su rol
 * (ver requireFeature.middleware.ts) — nunca se consulta para el.
 */
const ROLE_FEATURE_DEFAULTS: Partial<Record<Role, Record<Feature, boolean>>> = {
  [Role.ADMINISTRADOR]: {
    USUARIOS: true,
    PROYECTOS: true,
    CLIENTES: true,
    INVENTARIO: true,
    EVIDENCIAS: true,
    FACTURAS: true,
    EMERGENCIAS: true,
    REPORTES: true,
  },
  [Role.SUPERVISOR]: {
    USUARIOS: true,
    PROYECTOS: true,
    CLIENTES: true,
    INVENTARIO: true,
    EVIDENCIAS: true,
    FACTURAS: false,
    EMERGENCIAS: true,
    // Al igual que FACTURAS: la ruta ya es ADMINISTRADOR/GERENTE-only (ver
    // reports.routes.ts), este default es solo para que /permissions no
    // muestre un estado inconsistente si algun dia se relaja el rol.
    REPORTES: false,
  },
  [Role.MERCADERISTA]: {
    USUARIOS: false,
    PROYECTOS: false,
    CLIENTES: false,
    INVENTARIO: true,
    EVIDENCIAS: false,
    FACTURAS: false,
    EMERGENCIAS: false,
    REPORTES: false,
  },
};

/**
 * Punto unico de verdad para "este usuario tiene acceso a esta seccion":
 * lo usa tanto requireFeature.middleware.ts (para bloquear) como
 * getEffectivePermissions (para mostrar el estado en /permissions).
 * GERENTE siempre true, sin excepcion — ni siquiera consulta la DB — para
 * que nunca pueda quedar bloqueado a si mismo (ver comentario en el schema
 * de UserFeatureAccess).
 */
export async function hasFeatureAccess(userId: string, role: Role, feature: Feature): Promise<boolean> {
  if (role === Role.GERENTE) {
    return true;
  }

  const override = await prisma.userFeatureAccess.findUnique({
    where: { userId_feature: { userId, feature } },
  });
  if (override) {
    return override.granted;
  }

  return ROLE_FEATURE_DEFAULTS[role]?.[feature] ?? false;
}

async function getTargetUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  return user;
}

/** Estado efectivo (default + override ya resuelto) de las 6 Feature para un usuario. */
export async function getEffectivePermissions(userId: string): Promise<Record<Feature, boolean>> {
  const user = await getTargetUserOrThrow(userId);

  const entries = await Promise.all(
    ALL_FEATURES.map(async (feature) => [feature, await hasFeatureAccess(user.id, user.role, feature)] as const),
  );

  return Object.fromEntries(entries) as Record<Feature, boolean>;
}

/**
 * Crea o actualiza el override de una Feature puntual. No bloquea escribir
 * sobre un usuario GERENTE ni TRABAJADOR_CAMPO — es inofensivo dejarlo
 * escrito igual, hasFeatureAccess/requireFeature simplemente lo ignoran
 * para esos roles (mas simple que prohibir la escritura en dos lugares).
 */
export async function setFeatureAccess(
  targetUserId: string,
  feature: Feature,
  granted: boolean,
  grantedById: string,
): Promise<Record<Feature, boolean>> {
  await getTargetUserOrThrow(targetUserId);

  await prisma.userFeatureAccess.upsert({
    where: { userId_feature: { userId: targetUserId, feature } },
    update: { granted, grantedById },
    create: { userId: targetUserId, feature, granted, grantedById },
  });

  return getEffectivePermissions(targetUserId);
}
