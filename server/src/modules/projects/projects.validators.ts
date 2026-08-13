import { z } from "zod";
import { ProjectPriority, ProjectPropertyType, ProjectSector, ProjectStatus, ProjectWorkType } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),

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
