import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as timeEntriesService from "./time-entries.service";
import {
  autoCheckSchema,
  createTimeEntrySchema,
  listMyTimeEntriesQuerySchema,
  listTimeEntriesQuerySchema,
  summaryMineQuerySchema,
  summaryQuerySchema,
  updateTimeEntrySchema,
} from "./time-entries.validators";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createTimeEntrySchema.parse(req.body);
  const timeEntry = await timeEntriesService.createTimeEntry(req.user!, input);
  res.status(201).json({ timeEntry });
});

export const autoCheck = asyncHandler(async (req: Request, res: Response) => {
  const input = autoCheckSchema.parse(req.body);
  const result = await timeEntriesService.autoCheck(req.user!, input);
  res.json(result);
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

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const filters = summaryQuerySchema.parse(req.query);
  const summary = await timeEntriesService.getSummary(filters);
  res.json({ summary });
});

export const summaryMine = asyncHandler(async (req: Request, res: Response) => {
  const filters = summaryMineQuerySchema.parse(req.query);
  const summary = await timeEntriesService.getSummary({ ...filters, userId: req.user!.id });
  res.json({ summary });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateTimeEntrySchema.parse(req.body);
  const timeEntry = await timeEntriesService.updateTimeEntry(req.user!, req.params.timeEntryId, input);
  res.json({ timeEntry });
});
