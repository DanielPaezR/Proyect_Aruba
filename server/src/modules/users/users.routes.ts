import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as usersController from "./users.controller";

export const usersRouter = Router();

// Mapa de equipo: parte de la seccion "USUARIOS" del sistema de permisos
// (ver auth.routes.ts para el resto de /users).
usersRouter.use(authenticate, requireFeature(Feature.USUARIOS));
usersRouter.get(
  "/locations",
  authorize(Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR),
  usersController.locations,
);
