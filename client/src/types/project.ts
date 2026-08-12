import type { Activity } from "./activity";

export const PROJECT_STATUSES = ["PLANIFICADO", "EN_PROGRESO", "PAUSADO", "COMPLETADO", "CANCELADO"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number };
}

/** Forma de GET /api/projects/:projectId — incluye las actividades completas, no un conteo. */
export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}
