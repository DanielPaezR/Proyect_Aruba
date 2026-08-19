import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as inventoryService from "./inventory.service";
import { createInventoryItemSchema, listInventoryQuerySchema, updateInventoryItemSchema } from "./inventory.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listInventoryQuerySchema.parse(req.query);
  const items = await inventoryService.listInventory(filters);
  res.json({ items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createInventoryItemSchema.parse(req.body);
  const item = await inventoryService.createInventoryItem(input);
  res.status(201).json({ item });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateInventoryItemSchema.parse(req.body);
  const item = await inventoryService.updateInventoryItem(req.params.itemId, input);
  res.json({ item });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await inventoryService.deleteInventoryItem(req.params.itemId);
  res.status(204).send();
});
