import { z } from "zod";
import { InventoryItemType } from "@prisma/client";

export const listInventoryQuerySchema = z.object({
  type: z.nativeEnum(InventoryItemType).optional(),
});

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(InventoryItemType),
  unit: z.string().trim().min(1),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
