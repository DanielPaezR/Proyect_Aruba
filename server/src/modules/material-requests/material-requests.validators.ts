import { z } from "zod";
import { MaterialRequestStatus } from "@prisma/client";

export const listMaterialRequestsQuerySchema = z.object({
  status: z.nativeEnum(MaterialRequestStatus).optional(),
});

// itemId o itemNameFreeText: puede pedirse algo que todavia no esta en el
// catalogo, via texto libre en vez de una referencia real (ver comentario en
// el schema de Prisma).
export const createMaterialRequestSchema = z
  .object({
    itemId: z.string().min(1).optional(),
    itemNameFreeText: z.string().trim().min(1).optional(),
    quantity: z.number().int().positive(),
    reason: z.string().trim().min(1),
  })
  .refine((data) => Boolean(data.itemId) || Boolean(data.itemNameFreeText), {
    message: "Debe indicar un ítem del catálogo o un nombre libre",
    path: ["itemId"],
  });

export const resolveMaterialRequestSchema = z.object({
  status: z.enum([MaterialRequestStatus.APROBADA, MaterialRequestStatus.RECHAZADA, MaterialRequestStatus.ENTREGADA]),
  resolutionNote: z.string().trim().min(1).optional(),
});

export type ListMaterialRequestsQuery = z.infer<typeof listMaterialRequestsQuerySchema>;
export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export type ResolveMaterialRequestInput = z.infer<typeof resolveMaterialRequestSchema>;
