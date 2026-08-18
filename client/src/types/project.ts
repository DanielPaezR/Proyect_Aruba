import type { Activity } from "./activity";

export const PROJECT_STATUSES = ["PLANIFICADO", "EN_PROGRESO", "PAUSADO", "COMPLETADO", "CANCELADO"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_SECTORS = [
  "ORANJESTAD",
  "SAN_NICOLAS",
  "NOORD",
  "SANTA_CRUZ",
  "PARADERA",
  "SAVANETA",
  "OTRO",
] as const;
export type ProjectSector = (typeof PROJECT_SECTORS)[number];

export const PROJECT_PROPERTY_TYPES = ["RESIDENCIAL", "COMERCIAL", "INDUSTRIAL"] as const;
export type ProjectPropertyType = (typeof PROJECT_PROPERTY_TYPES)[number];

export const PROJECT_WORK_TYPES = [
  "INSTALACION_NUEVA",
  "REMODELACION",
  "MANTENIMIENTO",
  "REPARACION_EMERGENCIA",
  "INSPECCION",
] as const;
export type ProjectWorkType = (typeof PROJECT_WORK_TYPES)[number];

export const PROJECT_PRIORITIES = ["BAJA", "MEDIA", "ALTA", "URGENTE"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export interface ProjectClientSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

/** Info operativa del sitio de trabajo — nullable en DB, ver server/prisma/schema.prisma. */
interface ProjectOperationalFields {
  clientId: string | null;
  // Respaldo del owner en texto libre, anterior al modelo Client — ya no se
  // editan ni se muestran en el cliente, se mantienen solo porque el backend
  // todavia los devuelve (ver prisma/migrate-owners-to-clients.ts).
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  address: string | null;
  sector: ProjectSector | null;
  accessNotes: string | null;
  propertyType: ProjectPropertyType | null;
  workType: ProjectWorkType | null;
  priority: ProjectPriority | null;
  electricalPlansUrl: string | null;
}

export interface Project extends ProjectOperationalFields {
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
export interface ProjectDetail extends ProjectOperationalFields {
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
  client: ProjectClientSummary | null;
  activities: Activity[];
}
