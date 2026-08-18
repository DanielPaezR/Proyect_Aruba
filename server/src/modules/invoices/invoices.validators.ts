import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

export const listInvoicesQuerySchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
});

export const returnInvoiceSchema = z.object({
  comment: z.string().trim().min(1),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type ReturnInvoiceInput = z.infer<typeof returnInvoiceSchema>;
