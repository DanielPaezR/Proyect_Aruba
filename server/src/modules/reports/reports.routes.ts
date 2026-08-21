import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as reportsController from "./reports.controller";

export const reportsRouter = Router();

// ADMINISTRADOR/GERENTE-only a nivel de rol (ni siquiera SUPERVISOR, a
// diferencia de emergencies.routes.ts) + requireFeature encima para que el
// Gerente pueda ocultarsela a un Administrador puntual.
reportsRouter.use(authenticate, authorize(Role.ADMINISTRADOR, Role.GERENTE), requireFeature(Feature.REPORTES));

reportsRouter.get("/performance", reportsController.getPerformance);
