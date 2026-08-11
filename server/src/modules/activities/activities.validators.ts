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
  scheduledDate: z.coerce.date().optional(),
});

export const updateActivityStatusSchema = z.object({
  status: z.nativeEnum(ActivityStatus),
});

export const listActivitiesQuerySchema = z.object({
  status: z.nativeEnum(ActivityStatus).optional(),
  assignedToId: z.string().optional(),
});

export const assignWorkerSchema = z.object({
  userId: z.string(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
