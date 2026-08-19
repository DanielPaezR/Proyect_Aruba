import { z } from "zod";
import { ActivityStatus } from "@prisma/client";

export const createActivitySchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  assignedUserIds: z.array(z.string()).optional(),
});

export const updateActivitySchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  // Nullable ademas de opcional: hace falta poder mandar null explicito para
  // desprogramar una actividad ya programada, no solo dejarla sin fecha al crear.
  scheduledDate: z.coerce.date().nullable().optional(),
});

export const updateActivityStatusSchema = z.object({
  status: z.nativeEnum(ActivityStatus),
});

export const listActivitiesQuerySchema = z.object({
  status: z.nativeEnum(ActivityStatus).optional(),
  assignedToId: z.string().optional(),
});

export const listScheduledActivitiesQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const assignWorkerSchema = z.object({
  userId: z.string(),
});

// El motivo es obligatorio: nunca se omite una actividad sin explicar por
// que, es lo que le llega a Administrador/Gerente/Supervisor para poder reprogramarla.
export const skipActivitySchema = z.object({
  reason: z.string().min(1, "El motivo es obligatorio"),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type SkipActivityInput = z.infer<typeof skipActivitySchema>;
