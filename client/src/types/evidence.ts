export const EVIDENCE_STATUSES = ["PENDIENTE", "APROBADA", "RECHAZADA"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface Evidence {
  id: string;
  activityId: string;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  imageUrl: string;
  description: string | null;
  status: EvidenceStatus;
  reviewedById: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Forma de GET /api/evidences (Jefe/Supervisor) — incluye la actividad y su proyecto. */
export interface EvidenceWithActivity extends Evidence {
  activity: {
    id: string;
    title: string;
    projectId: string;
    project: { id: string; name: string };
  };
}
