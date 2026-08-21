import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as emergenciesService from "./emergencies.service";
import {
  assignEmergencySchema,
  createEmergencySchema,
  listEmergenciesQuerySchema,
  resolveEmergencySchema,
  updateEmergencySchema,
} from "./emergencies.validators";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createEmergencySchema.parse(req.body);
  const emergency = await emergenciesService.createEmergency(req.user!.id, input);
  res.status(201).json({ emergency });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listEmergenciesQuerySchema.parse(req.query);
  const emergencies = await emergenciesService.listEmergencies(filters);
  res.json({ emergencies });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const emergencies = await emergenciesService.listMyEmergencies(req.user!.id);
  res.json({ emergencies });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateEmergencySchema.parse(req.body);
  const emergency = await emergenciesService.updateEmergency(req.params.emergencyId, input);
  res.json({ emergency });
});

export const assignWorker = asyncHandler(async (req: Request, res: Response) => {
  const input = assignEmergencySchema.parse(req.body);
  const assignment = await emergenciesService.assignWorker(req.params.emergencyId, input);
  res.status(201).json({ assignment });
});

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const input = resolveEmergencySchema.parse(req.body);
  const emergency = await emergenciesService.resolveEmergency(req.params.emergencyId, input);
  res.json({ emergency });
});
