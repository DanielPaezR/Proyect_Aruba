import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as financialHistoryService from "./financial-history.service";
import { financialHistoryQuerySchema } from "./financial-history.validators";

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const query = financialHistoryQuerySchema.parse(req.query);
  const history = await financialHistoryService.getFinancialHistory(query);
  res.json(history);
});
