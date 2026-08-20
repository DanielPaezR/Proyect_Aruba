import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as vehiclesService from "./vehicles.service";
import {
  createFuelLogSchema,
  createVehicleIncidentSchema,
  createVehicleSchema,
  listVehicleIncidentsQuerySchema,
  resolveVehicleIncidentSchema,
  updateVehicleSchema,
} from "./vehicles.validators";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const vehicles = await vehiclesService.listVehicles();
  res.json({ vehicles });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const vehicles = await vehiclesService.listMyVehicles(req.user!.id);
  res.json({ vehicles });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createVehicleSchema.parse(req.body);
  const vehicle = await vehiclesService.createVehicle(input);
  res.status(201).json({ vehicle });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateVehicleSchema.parse(req.body);
  const vehicle = await vehiclesService.updateVehicle(req.params.id, input);
  res.json({ vehicle });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await vehiclesService.deleteVehicle(req.params.id);
  res.status(204).send();
});

export const createFuelLog = asyncHandler(async (req: Request, res: Response) => {
  const input = createFuelLogSchema.parse(req.body);
  const fuelLog = await vehiclesService.createFuelLog(req.user!, req.params.id, input);
  res.status(201).json({ fuelLog });
});

export const listFuelLogs = asyncHandler(async (req: Request, res: Response) => {
  const fuelLogs = await vehiclesService.listFuelLogs(req.user!, req.params.id);
  res.json({ fuelLogs });
});

export const createIncident = asyncHandler(async (req: Request, res: Response) => {
  const input = createVehicleIncidentSchema.parse(req.body);
  const incident = await vehiclesService.createVehicleIncident(req.user!, req.params.id, input, req.file);
  res.status(201).json({ incident });
});

export const listIncidents = asyncHandler(async (req: Request, res: Response) => {
  const filters = listVehicleIncidentsQuerySchema.parse(req.query);
  const incidents = await vehiclesService.listVehicleIncidents(filters);
  res.json({ incidents });
});

export const resolveIncident = asyncHandler(async (req: Request, res: Response) => {
  const input = resolveVehicleIncidentSchema.parse(req.body);
  const incident = await vehiclesService.resolveVehicleIncident(req.params.incidentId, input);
  res.json({ incident });
});
