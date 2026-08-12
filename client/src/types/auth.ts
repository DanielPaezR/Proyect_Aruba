export const ROLES = ["JEFE", "SUPERVISOR", "TRABAJADOR_CAMPO"] as const;
export type UserRole = (typeof ROLES)[number];

export const LOCALES = ["ES", "EN", "PAP"] as const;
export type UserLocale = (typeof LOCALES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  locale: UserLocale;
  createdAt: string;
}
