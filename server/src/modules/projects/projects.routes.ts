import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { projectActivitiesRouter } from "../activities/activities.routes";
import { projectChatRouter } from "../chat/chat.routes";
import { projectInvoicesRouter } from "../invoices/invoices.routes";
import { projectPaymentsRouter } from "../payments/payments.routes";
import * as projectsController from "./projects.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get("/", projectsController.list);
projectsRouter.post("/", authorize(...MANAGERS), projectsController.create);
projectsRouter.get("/:projectId", projectsController.getOne);
projectsRouter.patch("/:projectId", authorize(...MANAGERS), projectsController.update);
projectsRouter.delete("/:projectId", authorize(Role.ADMINISTRADOR, Role.GERENTE), projectsController.remove);

projectsRouter.use("/:projectId/activities", projectActivitiesRouter);
projectsRouter.use("/:projectId/invoices", projectInvoicesRouter);
projectsRouter.use("/:projectId/payments", projectPaymentsRouter);
projectsRouter.use("/:projectId/messages", projectChatRouter);
