import { z } from "zod";
import { ToolIncidentType } from "@prisma/client";

// No hay columna "status" real en ToolIncidentReport (solo resolvedAt
// nullable) — este filtro es la traduccion de PENDIENTE/RESUELTO pedida al
// chequeo real de resolvedAt, ver tool-incident-reports.service.ts.
export const listToolIncidentReportsQuerySchema = z.object({
  status: z.enum(["PENDIENTE", "RESUELTO"]).optional(),
});

export const createToolIncidentReportSchema = z.object({
  toolAssignmentId: z.string().min(1),
  type: z.nativeEnum(ToolIncidentType),
  description: z.string().trim().min(1),
});

export const resolveToolIncidentReportSchema = z.object({
  resolutionNote: z.string().trim().optional(),
});

export type ListToolIncidentReportsQuery = z.infer<typeof listToolIncidentReportsQuerySchema>;
export type CreateToolIncidentReportInput = z.infer<typeof createToolIncidentReportSchema>;
export type ResolveToolIncidentReportInput = z.infer<typeof resolveToolIncidentReportSchema>;
