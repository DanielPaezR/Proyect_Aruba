export const ROLES = ["JEFE", "SUPERVISOR", "TRABAJADOR_CAMPO", "MERCADERISTA"] as const;
export type UserRole = (typeof ROLES)[number];

/** JEFE y SUPERVISOR comparten los mismos permisos de gestión en casi toda la app. */
export function isManagerRole(role: UserRole): boolean {
  return role === "JEFE" || role === "SUPERVISOR";
}

/** Administra inventario — separado de isManagerRole a propósito, mismo
 * criterio que INVENTORY_ROLES en el backend (auth.middleware.ts). */
export function isInventoryRole(role: UserRole): boolean {
  return role === "MERCADERISTA" || role === "JEFE";
}

/** Puede marcar ENTRADA/SALIDA (ver /time-entries): Trabajador de Campo y
 * Supervisor, nunca el Jefe. El backend ya lo permite para cualquier
 * autenticado — esto es solo la condicion de UI (pestaña "Horas", geocerca de
 * referencia, etc). Explicito en vez de `role !== "JEFE"` a propósito: una
 * negacion sobre roles incluiria por descarte cualquier rol nuevo que se
 * agregue despues, sin que nadie decida realmente si debería marcar horario. */
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
