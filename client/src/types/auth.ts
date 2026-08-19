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
  isActive: boolean;
  locale: UserLocale;
  photoUrl: string | null;
  specialties: string[];
  createdAt: string;
}
