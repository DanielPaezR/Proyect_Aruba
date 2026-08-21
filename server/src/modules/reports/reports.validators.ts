import { z } from "zod";

export const performanceReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
});

export type PerformanceReportQuery = z.infer<typeof performanceReportQuerySchema>;
