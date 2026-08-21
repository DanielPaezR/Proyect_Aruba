import { z } from "zod";
import { EmergencyPriority, EmergencyStatus } from "@prisma/client";
import { mapsUrlSchema } from "../projects/projects.validators";

export const createEmergencySchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().min(1),
  locationMapsUrl: mapsUrlSchema,
  priority: z.nativeEnum(EmergencyPriority).optional(),
});

// Sin "RESUELTA" en los status editables aca a proposito: esa transicion va
// siempre por PATCH /:id/resolve, que fija resolvedAt junto con el status en
// el mismo paso — nunca por separado.
export const updateEmergencySchema = z.object({
  projectId: z.string().nullable().optional(),
  title: z.string().min(2).optional(),
  description: z.string().min(1).optional(),
  locationMapsUrl: mapsUrlSchema,
  priority: z.nativeEnum(EmergencyPriority).optional(),
  status: z
    .nativeEnum(EmergencyStatus)
    .refine((status) => status !== EmergencyStatus.RESUELTA, "Usa PATCH /:id/resolve para marcar como resuelta")
    .optional(),
});

export const listEmergenciesQuerySchema = z.object({
  status: z.nativeEnum(EmergencyStatus).optional(),
});

export const assignEmergencySchema = z.object({
  userId: z.string(),
});

export const resolveEmergencySchema = z.object({
  resolutionNote: z.string().optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
export type UpdateEmergencyInput = z.infer<typeof updateEmergencySchema>;
export type ListEmergenciesQuery = z.infer<typeof listEmergenciesQuerySchema>;
export type AssignEmergencyInput = z.infer<typeof assignEmergencySchema>;
export type ResolveEmergencyInput = z.infer<typeof resolveEmergencySchema>;
