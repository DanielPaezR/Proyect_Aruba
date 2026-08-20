import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { mediaUpload } from "../../config/storage";
import { activityEvidencesRouter } from "../evidences/evidences.routes";
import * as activitiesController from "./activities.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

/** Se monta anidado en /api/projects/:projectId/activities */
export const projectActivitiesRouter = Router({ mergeParams: true });

projectActivitiesRouter.use(authenticate);
projectActivitiesRouter.get("/", activitiesController.listForProject);
projectActivitiesRouter.post(
  "/",
  authorize(...MANAGERS),
  mediaUpload.single("referenceImage"),
  activitiesController.create,
);

/** Se monta en /api/activities */
export const activitiesRouter = Router();

activitiesRouter.use(authenticate);
activitiesRouter.get("/mine", activitiesController.listMine);
// Antes de /:activityId para no quedar shadowed por el parametro dinamico.
// Usada por la agenda de Administrador/Gerente/Supervisor (ver agenda-events)
// para combinar actividades programadas con AgendaEvent en una sola vista.
activitiesRouter.get("/scheduled", authorize(...MANAGERS), activitiesController.listScheduled);
activitiesRouter.get("/:activityId", activitiesController.getOne);
activitiesRouter.patch(
  "/:activityId",
  authorize(...MANAGERS),
  mediaUpload.single("referenceImage"),
  activitiesController.update,
);
activitiesRouter.delete("/:activityId", authorize(...MANAGERS), activitiesController.remove);

// Cambio de estado: permitido a Administrador/Gerente/Supervisor siempre, y
// al trabajador asignado solo para pasar a EN_PROGRESO/COMPLETADA (verificado
// en el service).
activitiesRouter.patch("/:activityId/status", activitiesController.updateStatus);

// Omitir: igual que /status, sin authorize a nivel de ruta — el service
// permite Administrador/Gerente/Supervisor siempre, y al trabajador solo si esta asignado.
activitiesRouter.patch("/:activityId/skip", activitiesController.skipActivity);

activitiesRouter.post(
  "/:activityId/assignments",
  authorize(...MANAGERS),
  activitiesController.assignWorker,
);
activitiesRouter.delete(
  "/:activityId/assignments/:userId",
  authorize(...MANAGERS),
  activitiesController.unassignWorker,
);

activitiesRouter.use("/:activityId/evidences", activityEvidencesRouter);
