import type { ProjectWorkType } from "./project";

export const ACTIVITY_STATUSES = ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA", "OMITIDA"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface ActivityAssignment {
  id: string;
  activityId: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string };
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  scheduledDate: string | null;
  completedAt: string | null;
  skipReason: string | null;
  skippedAt: string | null;
  skippedById: string | null;
  skippedBy: { id: string; name: string } | null;
  /** Imagen de referencia opcional subida por ADMINISTRADOR/GERENTE/SUPERVISOR
   * (que hay que hacer) — distinta de las evidencias que sube el trabajador (que se hizo). */
  referenceImageUrl: string | null;
  referenceImagePublicId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assignments: ActivityAssignment[];
  _count?: { evidences: number };
  /** Solo presente en GET /api/activities/mine. */
  project?: {
    id: string;
    name: string;
    address: string | null;
    mapsUrl: string | null;
    workType: ProjectWorkType | null;
  };
}
