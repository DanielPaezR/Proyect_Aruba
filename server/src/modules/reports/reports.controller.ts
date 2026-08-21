import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reportsService from "./reports.service";
import { performanceReportQuerySchema } from "./reports.validators";

export const getPerformance = asyncHandler(async (req: Request, res: Response) => {
  const query = performanceReportQuerySchema.parse(req.query);
  const report = await reportsService.getPerformanceReport(query);
  res.json(report);
});
