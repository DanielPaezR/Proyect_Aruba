// GERENTE es el rol mas nuevo: por encima de todos, mismo acceso que
// ADMINISTRADOR (antiguo JEFE, mismo valor en la base de datos via @map en
// el schema de Prisma) en todo lo existente, mas gestion de permisos.
export const ROLES = ["GERENTE", "ADMINISTRADOR", "SUPERVISOR", "TRABAJADOR_CAMPO", "MERCADERISTA"] as const;
export type UserRole = (typeof ROLES)[number];

/** ADMINISTRADOR, GERENTE y SUPERVISOR comparten los mismos permisos de gestión en casi toda la app. */
export function isManagerRole(role: UserRole): boolean {
  return role === "ADMINISTRADOR" || role === "GERENTE" || role === "SUPERVISOR";
}

/** Acceso equivalente al antiguo "solo JEFE": ahora ADMINISTRADOR y GERENTE
 * (mismo acceso que ADMINISTRADOR en todo lo existente, por diseño de la
 * reestructuración de roles). Para lo que YA no comparte con Supervisor
 * (borrar proyectos/usuarios/clientes, gestión de usuarios, dinero, etc). */
export function isTopManagerRole(role: UserRole): boolean {
  return role === "ADMINISTRADOR" || role === "GERENTE";
}

/** Administra inventario — separado de isManagerRole a propósito, mismo
 * criterio que INVENTORY_ROLES en el backend (auth.middleware.ts). */
export function isInventoryRole(role: UserRole): boolean {
  return role === "MERCADERISTA" || role === "ADMINISTRADOR" || role === "GERENTE";
}

/** Puede marcar ENTRADA/SALIDA (ver /time-entries): Trabajador de Campo y
 * Supervisor, nunca Administrador ni Gerente. El backend ya lo permite para
 * cualquier autenticado — esto es solo la condicion de UI (pestaña "Horas",
 * geocerca de referencia, etc). Explicito en vez de negar contra
 * Administrador/Gerente a propósito: una negacion sobre roles incluiria por
 * descarte cualquier rol nuevo que se agregue despues, sin que nadie decida
 * realmente si debería marcar horario. */
export function isTimeTrackingRole(role: UserRole): boolean {
  return role === "TRABAJADOR_CAMPO" || role === "SUPERVISOR";
}

export const LOCALES = ["ES", "EN", "PAP"] as const;
export type UserLocale = (typeof LOCALES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  // Serializado por Prisma/Express como string decimal (ej. "18.5"), no number.
  hourlyRate: string | null;
  overtimeHourlyRate: string | null;
  isActive: boolean;
  locale: UserLocale;
  photoUrl: string | null;
  specialties: string[];
  createdAt: string;
}
