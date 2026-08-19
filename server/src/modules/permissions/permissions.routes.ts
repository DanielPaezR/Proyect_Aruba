import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as permissionsController from "./permissions.controller";

export const permissionsRouter = Router();

permissionsRouter.use(authenticate);

// Estado propio: cualquier autenticado, para condicionar su propia nav — no
// hace falta ser GERENTE para consultar que secciones tiene habilitadas uno mismo.
permissionsRouter.get("/mine", permissionsController.getMine);

// Gestion de permisos de otros: exclusivo de GERENTE, ni siquiera Administrador.
permissionsRouter.get("/:userId", authorize(Role.GERENTE), permissionsController.getForUser);
permissionsRouter.patch("/:userId", authorize(Role.GERENTE), permissionsController.updateForUser);
