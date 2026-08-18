import type { ProjectStatus } from "./project";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

export interface ClientProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}

/** Forma de GET /api/clients/:clientId — incluye el historial de proyectos vinculados. */
export interface ClientDetail extends Client {
  projects: ClientProjectSummary[];
}
