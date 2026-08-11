import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as dashboardService from "./dashboard.service";
import { dashboardQuerySchema } from "./dashboard.validators";

export const supervisorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { date } = dashboardQuerySchema.parse(req.query);
  const dashboard = await dashboardService.getSupervisorDashboard(date);
  res.json(dashboard);
});
