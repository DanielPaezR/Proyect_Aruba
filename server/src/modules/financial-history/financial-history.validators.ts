import { z } from "zod";

export const financialHistoryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  userId: z.string().optional(),
  type: z.enum(["INGRESO", "EGRESO"]).optional(),
});

export type FinancialHistoryQuery = z.infer<typeof financialHistoryQuerySchema>;
