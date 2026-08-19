import { z } from "zod";
import { PayrollStatus } from "@prisma/client";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido, usa YYYY-MM-DD");

// periodStart/periodEnd son dias calendario de Aruba, ambos inclusive (ej.
// "1 al 15 del mes") tal como los elige el Administrador/Gerente — el
// service arma el rango [start, end) exclusivo internamente al consultar
// getSummary()/SalaryAdjustment (ver arubaDayRangeUtc en utils/geo.ts).
export const generatePayrollSchema = z
  .object({
    userId: z.string().min(1),
    periodStart: dateStringSchema,
    periodEnd: dateStringSchema,
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "El periodo no puede terminar antes de que empiece",
    path: ["periodEnd"],
  });

export const listPayrollQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.nativeEnum(PayrollStatus).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;
export type ListPayrollQuery = z.infer<typeof listPayrollQuerySchema>;
