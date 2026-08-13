import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as pushService from "./push.service";
import { subscribeSchema } from "./push.validators";

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const input = subscribeSchema.parse(req.body);
  const subscription = await pushService.subscribe(req.user!.id, input);
  res.status(201).json({ subscription: { id: subscription.id } });
});
