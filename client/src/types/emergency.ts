export const EMERGENCY_PRIORITIES = ["MEDIA", "ALTA", "URGENTE"] as const;
export type EmergencyPriority = (typeof EMERGENCY_PRIORITIES)[number];

export const EMERGENCY_STATUSES = ["REPORTADA", "ASIGNADA", "EN_PROGRESO", "RESUELTA"] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export interface EmergencyAssignment {
  id: string;
  emergencyId: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string };
}

export interface Emergency {
  id: string;
  projectId: string | null;
  project: { id: string; name: string } | null;
  title: string;
  description: string;
  locationMapsUrl: string | null;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  reportedById: string;
  reportedBy: { id: string; name: string };
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  assignments: EmergencyAssignment[];
}
