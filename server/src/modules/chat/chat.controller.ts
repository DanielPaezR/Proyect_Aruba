import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as chatService from "./chat.service";
import { listMessagesQuerySchema } from "./chat.validators";

export const listForProject = asyncHandler(async (req: Request, res: Response) => {
  const filters = listMessagesQuerySchema.parse(req.query);
  const messages = await chatService.listMessagesForProject(req.user!, req.params.projectId, filters);
  res.json({ messages });
});
