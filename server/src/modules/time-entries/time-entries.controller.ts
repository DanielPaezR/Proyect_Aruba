import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as timeEntriesService from "./time-entries.service";
import {
  createTimeEntrySchema,
  listMyTimeEntriesQuerySchema,
  listTimeEntriesQuerySchema,
} from "./time-entries.validators";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createTimeEntrySchema.parse(req.body);
  const timeEntry = await timeEntriesService.createTimeEntry(req.user!, input);
  res.status(201).json({ timeEntry });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const filters = listMyTimeEntriesQuerySchema.parse(req.query);
  const timeEntries = await timeEntriesService.listMine(req.user!.id, filters);
  res.json({ timeEntries });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listTimeEntriesQuerySchema.parse(req.query);
  const timeEntries = await timeEntriesService.listForManagers(filters);
  res.json({ timeEntries });
});
