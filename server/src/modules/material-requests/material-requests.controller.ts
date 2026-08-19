import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as materialRequestsService from "./material-requests.service";
import {
  createMaterialRequestSchema,
  listMaterialRequestsQuerySchema,
  resolveMaterialRequestSchema,
} from "./material-requests.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listMaterialRequestsQuerySchema.parse(req.query);
  const requests = await materialRequestsService.listMaterialRequests(filters);
  res.json({ requests });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const filters = listMaterialRequestsQuerySchema.parse(req.query);
  const requests = await materialRequestsService.listMyMaterialRequests(req.user!.id, filters);
  res.json({ requests });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createMaterialRequestSchema.parse(req.body);
  const request = await materialRequestsService.createMaterialRequest(req.user!.id, input);
  res.status(201).json({ request });
});

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const input = resolveMaterialRequestSchema.parse(req.body);
  const request = await materialRequestsService.resolveMaterialRequest(req.user!.id, req.params.requestId, input);
  res.json({ request });
});
