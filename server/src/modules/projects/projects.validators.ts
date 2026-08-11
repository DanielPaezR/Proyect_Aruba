import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const listProjectsQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
