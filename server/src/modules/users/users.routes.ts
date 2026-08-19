import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as usersController from "./users.controller";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get(
  "/locations",
  authorize(Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR),
  usersController.locations,
);
