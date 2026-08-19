import type { UserLocale, UserRole } from "./auth";
import type { ProjectStatus } from "./project";

/** Forma de GET /api/auth/users/:userId/profile. hourlyRate/overtimeHourlyRate
 * quedan ausentes del todo (no null, ausentes) cuando quien pregunta es
 * SUPERVISOR — mismo criterio que el resto de la app para ese par de campos. */
export interface WorkerProfileUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  locale: UserLocale;
  photoUrl: string | null;
  createdAt: string;
  hireDate: string | null;
  specialties: string[];
  workDaysPerWeek: number | null;
  workScheduleNote: string | null;
  hourlyRate?: string | null;
  overtimeHourlyRate?: string | null;
}

export interface WorkerProfileProject {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface WorkerProfile {
  user: WorkerProfileUser;
  projects: WorkerProfileProject[];
  hoursThisMonth: number;
}
