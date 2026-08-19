import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as settingsController from "./settings.controller";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get("/", settingsController.getSettings);
settingsRouter.patch("/", authorize(Role.ADMINISTRADOR, Role.GERENTE), settingsController.updateSettings);
