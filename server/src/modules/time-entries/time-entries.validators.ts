import { z } from "zod";
import { PunchType } from "@prisma/client";

export const createTimeEntrySchema = z.object({
  type: z.nativeEnum(PunchType),
  activityId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const autoCheckSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const listMyTimeEntriesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listTimeEntriesQuerySchema = z.object({
  userId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type AutoCheckInput = z.infer<typeof autoCheckSchema>;
