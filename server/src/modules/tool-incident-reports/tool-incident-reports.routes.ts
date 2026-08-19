import { Router } from "express";
import { Feature } from "@prisma/client";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as toolIncidentReportsController from "./tool-incident-reports.controller";

export const toolIncidentReportsRouter = Router();

// requireFeature no bloquea nunca a TRABAJADOR_CAMPO, asi que reportar un
// daño/perdida propio (abajo) sigue funcionando igual sin importar el
// estado de esta Feature.
toolIncidentReportsRouter.use(authenticate, requireFeature(Feature.INVENTARIO));

toolIncidentReportsRouter.get("/", authorize(...INVENTORY_ROLES), toolIncidentReportsController.list);

// Crear el reporte: no estaba en la lista original de rutas del pedido, pero
// sin esto no hay forma de que exista un reporte que resolver — el modelo ya
// preveía que "el trabajador reporta que se dañó o perdió algo que tiene a
// cargo" (ver schema.prisma). Sin authorize a nivel de ruta: el service
// decide (dueño de la herramienta, o Administrador/Gerente/Supervisor/Mercaderista).
toolIncidentReportsRouter.post("/", toolIncidentReportsController.create);

toolIncidentReportsRouter.patch(
  "/:reportId/resolve",
  authorize(...INVENTORY_ROLES),
  toolIncidentReportsController.resolve,
);
