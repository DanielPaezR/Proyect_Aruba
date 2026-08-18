import { z } from "zod";
import { ProjectPriority, ProjectPropertyType, ProjectSector, ProjectStatus, ProjectWorkType } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),

  // Opcional mientras conviven el Client real y el owner en texto libre de
  // abajo (ver prisma/migrate-owners-to-clients.ts). Nullable ademas de
  // opcional: clientId es nullable a nivel de DB, hace falta poder mandar
  // null explicito para desvincular un proyecto de su cliente.
  clientId: z.string().nullable().optional(),

  // Información operativa del sitio de trabajo.
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(1),
  ownerEmail: z.string().email().optional(),
  address: z.string().min(1),
  sector: z.nativeEnum(ProjectSector).optional(),
  accessNotes: z.string().optional(),
  propertyType: z.nativeEnum(ProjectPropertyType),
  workType: z.nativeEnum(ProjectWorkType),
  priority: z.nativeEnum(ProjectPriority).optional(),
  electricalPlansUrl: z.string().url().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const listProjectsQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
