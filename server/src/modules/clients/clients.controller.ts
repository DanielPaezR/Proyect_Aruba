import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as clientsService from "./clients.service";
import { createClientSchema, updateClientSchema } from "./clients.validators";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const clients = await clientsService.listClients();
  res.json({ clients });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientsService.getClient(req.params.clientId);
  res.json({ client });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createClientSchema.parse(req.body);
  const client = await clientsService.createClient(input);
  res.status(201).json({ client });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateClientSchema.parse(req.body);
  const client = await clientsService.updateClient(req.params.clientId, input);
  res.json({ client });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await clientsService.deleteClient(req.params.clientId);
  res.status(204).send();
});
