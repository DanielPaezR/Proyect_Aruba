import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get(
  "/supervisor",
  authorize(Role.JEFE, Role.SUPERVISOR),
  dashboardController.supervisorDashboard,
);
