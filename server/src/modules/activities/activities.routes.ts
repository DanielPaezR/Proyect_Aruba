import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { imageUpload } from "../../config/storage";
import { activityEvidencesRouter } from "../evidences/evidences.routes";
import * as activitiesController from "./activities.controller";

const MANAGERS = [Role.JEFE, Role.SUPERVISOR];

/** Se monta anidado en /api/projects/:projectId/activities */
export const projectActivitiesRouter = Router({ mergeParams: true });

projectActivitiesRouter.use(authenticate);
projectActivitiesRouter.get("/", activitiesController.listForProject);
projectActivitiesRouter.post(
  "/",
  authorize(...MANAGERS),
  imageUpload.single("referenceImage"),
  activitiesController.create,
);

/** Se monta en /api/activities */
export const activitiesRouter = Router();

activitiesRouter.use(authenticate);
activitiesRouter.get("/mine", activitiesController.listMine);
activitiesRouter.get("/:activityId", activitiesController.getOne);
activitiesRouter.patch(
  "/:activityId",
  authorize(...MANAGERS),
  imageUpload.single("referenceImage"),
  activitiesController.update,
);
activitiesRouter.delete("/:activityId", authorize(...MANAGERS), activitiesController.remove);

// Cambio de estado: permitido a Jefe/Supervisor siempre, y al trabajador
// asignado solo para pasar a EN_PROGRESO/COMPLETADA (verificado en el service).
activitiesRouter.patch("/:activityId/status", activitiesController.updateStatus);

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
