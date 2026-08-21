import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as emergenciesController from "./emergencies.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const emergenciesRouter = Router();

// requireFeature nunca bloquea a TRABAJADOR_CAMPO (ver
// requireFeature.middleware.ts) — pasa de largo hacia /mine, la unica ruta
// sin authorize(...MANAGERS) encima.
emergenciesRouter.use(authenticate, requireFeature(Feature.EMERGENCIAS));

// Antes de "/" y "/:emergencyId" para no quedar shadowed por el parametro dinamico.
emergenciesRouter.get("/mine", emergenciesController.listMine);

emergenciesRouter.get("/", authorize(...MANAGERS), emergenciesController.list);
emergenciesRouter.post("/", authorize(...MANAGERS), emergenciesController.create);
emergenciesRouter.patch("/:emergencyId", authorize(...MANAGERS), emergenciesController.update);

// Al asignar, manda push inmediato (urgency alta) al trabajador — ver
// emergencies.service.ts assignWorker.
emergenciesRouter.post(
  "/:emergencyId/assignments",
  authorize(...MANAGERS),
  emergenciesController.assignWorker,
);

emergenciesRouter.patch("/:emergencyId/resolve", authorize(...MANAGERS), emergenciesController.resolve);
