import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as paymentsService from "./payments.service";
import { createPaymentSchema } from "./payments.validators";

export const listForProject = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentsService.listForProject(req.params.projectId);
  res.json(result);
});

export const listForClient = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentsService.listForClient(req.params.clientId);
  res.json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createPaymentSchema.parse(req.body);
  const payment = await paymentsService.createPayment(req.user!.id, req.params.projectId, input);
  res.status(201).json({ payment });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await paymentsService.deletePayment(req.params.paymentId);
  res.status(204).send();
});
