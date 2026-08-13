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

export const summaryQuerySchema = z.object({
  userId: z.string().optional(),
  // Dia unico ("horas de hoy por trabajador"). Si no se manda ni "date" ni
  // "from"/"to", el servicio usa el dia de hoy en Aruba por default.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido, usa YYYY-MM-DD").optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Igual que summaryQuerySchema pero sin "userId": el trabajador consulta su
// propio resumen, no puede pedir el de otro.
export const summaryMineQuerySchema = summaryQuerySchema.omit({ userId: true });

export const updateTimeEntrySchema = z.object({
  timestamp: z.coerce.date(),
  editReason: z.string().min(1).optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type AutoCheckInput = z.infer<typeof autoCheckSchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type SummaryMineQuery = z.infer<typeof summaryMineQuerySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
