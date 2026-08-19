import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import * as chatController from "./chat.controller";

/** Se monta anidado en /api/projects/:projectId/messages */
export const projectChatRouter = Router({ mergeParams: true });

projectChatRouter.use(authenticate);
// Sin authorize a nivel de ruta: el service decide (Jefe/Supervisor siempre,
// Trabajador de Campo solo si tiene alguna actividad asignada en el proyecto).
projectChatRouter.get("/", chatController.listForProject);
