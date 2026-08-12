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
