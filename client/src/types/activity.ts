export const ACTIVITY_STATUSES = ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA"] as const;
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
  /** Imagen de referencia opcional subida por JEFE/SUPERVISOR (que hay que
   * hacer) — distinta de las evidencias que sube el trabajador (que se hizo). */
  referenceImageUrl: string | null;
  referenceImagePublicId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assignments: ActivityAssignment[];
  _count?: { evidences: number };
  /** Solo presente en GET /api/activities/mine. */
  project?: { id: string; name: string; address: string | null };
}
