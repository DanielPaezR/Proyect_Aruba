import { z } from "zod";

export const performanceReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
});

export type PerformanceReportQuery = z.infer<typeof performanceReportQuerySchema>;

export const exportReportQuerySchema = z.object({
  type: z.enum(["project", "worker", "client"]),
  id: z.string().min(1),
  format: z.enum(["pdf", "xlsx"]),
});

export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;
