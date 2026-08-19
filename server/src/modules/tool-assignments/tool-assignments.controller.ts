import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as toolAssignmentsService from "./tool-assignments.service";
import { createToolAssignmentSchema, listToolAssignmentsQuerySchema } from "./tool-assignments.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listToolAssignmentsQuerySchema.parse(req.query);
  const assignments = await toolAssignmentsService.listToolAssignments(filters);
  res.json({ assignments });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await toolAssignmentsService.listToolAssignments({ userId: req.user!.id, active: true });
  res.json({ assignments });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createToolAssignmentSchema.parse(req.body);
  const assignment = await toolAssignmentsService.createToolAssignment(input);
  res.status(201).json({ assignment });
});

export const returnAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await toolAssignmentsService.returnToolAssignment(req.params.assignmentId);
  res.json({ assignment });
});
