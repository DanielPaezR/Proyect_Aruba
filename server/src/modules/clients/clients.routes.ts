import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { clientPaymentsRouter } from "../payments/payments.routes";
import * as clientsController from "./clients.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const clientsRouter = Router();

clientsRouter.use(authenticate, authorize(...MANAGERS));

clientsRouter.get("/", clientsController.list);
clientsRouter.post("/", clientsController.create);
clientsRouter.get("/:clientId", clientsController.getOne);
clientsRouter.patch("/:clientId", clientsController.update);
// Baja: solo Administrador/Gerente, mismo criterio que el resto de borrados sensibles
// (proyectos, usuarios).
clientsRouter.delete("/:clientId", authorize(Role.ADMINISTRADOR, Role.GERENTE), clientsController.remove);

clientsRouter.use("/:clientId/payments", clientPaymentsRouter);
