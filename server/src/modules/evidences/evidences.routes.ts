import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import { mediaUpload } from "../../config/storage";
import * as evidencesController from "./evidences.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

/** Se monta anidado en /api/activities/:activityId/evidences — sin
 * requireFeature: es donde el trabajador sube/ve SUS PROPIAS evidencias, no
 * la seccion de gestion (esa es evidencesRouter, abajo). */
export const activityEvidencesRouter = Router({ mergeParams: true });

activityEvidencesRouter.use(authenticate);
activityEvidencesRouter.get("/", evidencesController.listForActivity);
activityEvidencesRouter.post("/", mediaUpload.single("image"), evidencesController.upload);

/** Se monta en /api/evidences — cola de revision, con su "portón" propio.
 * TRABAJADOR_CAMPO igual puede llegar al DELETE (borrar su propia evidencia
 * PENDIENTE, sin authorize a nivel de ruta) pero requireFeature no lo
 * bloquea nunca — ver requireFeature.middleware.ts. */
export const evidencesRouter = Router();

evidencesRouter.use(authenticate, requireFeature(Feature.EVIDENCIAS));
evidencesRouter.get("/", authorize(...MANAGERS), evidencesController.list);
evidencesRouter.patch("/:evidenceId/review", authorize(...MANAGERS), evidencesController.review);
// Sin authorize a nivel de ruta: el service decide (dueño con evidencia PENDIENTE, o Administrador/Gerente).
evidencesRouter.delete("/:evidenceId", evidencesController.remove);
