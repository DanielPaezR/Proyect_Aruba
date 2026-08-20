import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import { imageUpload } from "../../config/storage";
import * as vehiclesController from "./vehicles.controller";

// Gestion de flota: mismo criterio de rol que projects (gestion operativa),
// no INVENTORY_ROLES — Mercaderista queda fuera a proposito, ver MANAGERS
// en vehicles.service.ts. requireFeature no bloquea nunca a
// TRABAJADOR_CAMPO, asi que /mine y las tanqueadas/incidentes del propio
// vehiculo (abajo) siguen funcionando igual sin importar el estado de esta
// Feature.
const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate, requireFeature(Feature.INVENTARIO));

// "Mi vehiculo": el propio trabajador con uno a cargo — sin esto no hay
// forma de que descubra el id de su vehiculo para registrar tanqueadas o
// incidentes (mismo motivo que /tool-assignments/mine). Sin authorize a
// nivel de ruta: el service ya filtra por assignedToId, no hay gestion
// ajena posible aca.
vehiclesRouter.get("/mine", vehiclesController.listMine);

vehiclesRouter.get("/", authorize(...MANAGERS), vehiclesController.list);
vehiclesRouter.post("/", authorize(...MANAGERS), vehiclesController.create);
vehiclesRouter.patch("/:id", authorize(...MANAGERS), vehiclesController.update);
vehiclesRouter.delete("/:id", authorize(...MANAGERS), vehiclesController.remove);

// Cola de revision de incidentes (todos los vehiculos) — solo gestion,
// mismo criterio que ToolIncidentReport.
vehiclesRouter.get("/incidents", authorize(...MANAGERS), vehiclesController.listIncidents);
vehiclesRouter.patch(
  "/incidents/:incidentId/resolve",
  authorize(...MANAGERS),
  vehiclesController.resolveIncident,
);

// Tanqueadas e incidentes de UN vehiculo: sin authorize a nivel de ruta, el
// service decide (dueño del vehiculo via assignedToId, o gestion).
vehiclesRouter.post("/:id/fuel-logs", vehiclesController.createFuelLog);
vehiclesRouter.get("/:id/fuel-logs", vehiclesController.listFuelLogs);
vehiclesRouter.post("/:id/incidents", imageUpload.single("photo"), vehiclesController.createIncident);
