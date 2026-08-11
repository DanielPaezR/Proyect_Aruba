import { z } from "zod";

export const dashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
