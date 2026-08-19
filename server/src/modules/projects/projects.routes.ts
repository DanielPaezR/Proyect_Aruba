import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import { projectActivitiesRouter } from "../activities/activities.routes";
import { projectChatRouter } from "../chat/chat.routes";
import { projectInvoicesRouter } from "../invoices/invoices.routes";
import { projectPaymentsRouter } from "../payments/payments.routes";
import * as projectsController from "./projects.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const projectsRouter = Router();

// El "portón" de la seccion completa (incluidas las sub-rutas anidadas:
// actividades del proyecto, facturas, pagos, chat) va antes que nada — no
// aplica a TRABAJADOR_CAMPO (ver requireFeature.middleware.ts), asi que el
// chat de proyecto del trabajador (ProjectChatPage, via /messages anidado)
// sigue funcionando igual sin importar el estado de esta Feature.
projectsRouter.use(authenticate, requireFeature(Feature.PROYECTOS));

projectsRouter.get("/", projectsController.list);
projectsRouter.post("/", authorize(...MANAGERS), projectsController.create);
projectsRouter.get("/:projectId", projectsController.getOne);
projectsRouter.patch("/:projectId", authorize(...MANAGERS), projectsController.update);
projectsRouter.delete("/:projectId", authorize(Role.ADMINISTRADOR, Role.GERENTE), projectsController.remove);

projectsRouter.use("/:projectId/activities", projectActivitiesRouter);
projectsRouter.use("/:projectId/invoices", projectInvoicesRouter);
projectsRouter.use("/:projectId/payments", projectPaymentsRouter);
projectsRouter.use("/:projectId/messages", projectChatRouter);
