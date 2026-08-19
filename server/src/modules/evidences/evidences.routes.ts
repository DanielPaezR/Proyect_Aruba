import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { imageUpload } from "../../config/storage";
import * as evidencesController from "./evidences.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

/** Se monta anidado en /api/activities/:activityId/evidences */
export const activityEvidencesRouter = Router({ mergeParams: true });

activityEvidencesRouter.use(authenticate);
activityEvidencesRouter.get("/", evidencesController.listForActivity);
activityEvidencesRouter.post("/", imageUpload.single("image"), evidencesController.upload);

/** Se monta en /api/evidences */
export const evidencesRouter = Router();

evidencesRouter.use(authenticate);
evidencesRouter.get("/", authorize(...MANAGERS), evidencesController.list);
evidencesRouter.patch("/:evidenceId/review", authorize(...MANAGERS), evidencesController.review);
// Sin authorize a nivel de ruta: el service decide (dueño con evidencia PENDIENTE, o Administrador/Gerente).
evidencesRouter.delete("/:evidenceId", evidencesController.remove);
