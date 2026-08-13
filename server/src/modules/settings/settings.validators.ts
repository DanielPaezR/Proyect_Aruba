import { z } from "zod";

const timeWindowSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido, usa HH:mm (ej. 06:30)");

export const updateSettingsSchema = z.object({
  officeLatitude: z.number().min(-90).max(90).optional(),
  officeLongitude: z.number().min(-180).max(180).optional(),
  officeRadiusMeters: z.number().int().positive().optional(),
  morningWindowStart: timeWindowSchema.optional(),
  morningWindowEnd: timeWindowSchema.optional(),
  afternoonWindowStart: timeWindowSchema.optional(),
  afternoonWindowEnd: timeWindowSchema.optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
