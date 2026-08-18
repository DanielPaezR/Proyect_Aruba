import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { projectActivitiesRouter } from "../activities/activities.routes";
import { projectInvoicesRouter } from "../invoices/invoices.routes";
import * as projectsController from "./projects.controller";

const MANAGERS = [Role.JEFE, Role.SUPERVISOR];

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get("/", projectsController.list);
projectsRouter.post("/", authorize(...MANAGERS), projectsController.create);
projectsRouter.get("/:projectId", projectsController.getOne);
projectsRouter.patch("/:projectId", authorize(...MANAGERS), projectsController.update);
projectsRouter.delete("/:projectId", authorize(Role.JEFE), projectsController.remove);

projectsRouter.use("/:projectId/activities", projectActivitiesRouter);
projectsRouter.use("/:projectId/invoices", projectInvoicesRouter);
