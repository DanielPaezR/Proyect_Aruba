import { Router } from "express";
import { Feature } from "@prisma/client";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as toolAssignmentsController from "./tool-assignments.controller";

export const toolAssignmentsRouter = Router();

// requireFeature no bloquea nunca a TRABAJADOR_CAMPO, asi que /mine (abajo)
// sigue funcionando igual sin importar el estado de esta Feature.
toolAssignmentsRouter.use(authenticate, requireFeature(Feature.INVENTARIO));

// "Mis herramientas": el propio Trabajador de Campo, sobre sus asignaciones
// activas — antes el router entero estaba gateado a INVENTORY_ROLES, lo que
// lo hubiera bloqueado tambien a esto. Sin authorize a nivel de ruta: el
// service ya filtra por userId, no hay gestion ajena posible aca.
toolAssignmentsRouter.get("/mine", toolAssignmentsController.listMine);

// GET no estaba en la lista original de rutas del pedido, pero sin ella no
// hay forma de mostrar en el cliente que herramienta tiene cada quien para
// poder marcarla como devuelta.
toolAssignmentsRouter.get("/", authorize(...INVENTORY_ROLES), toolAssignmentsController.list);
toolAssignmentsRouter.post("/", authorize(...INVENTORY_ROLES), toolAssignmentsController.create);
toolAssignmentsRouter.patch(
  "/:assignmentId/return",
  authorize(...INVENTORY_ROLES),
  toolAssignmentsController.returnAssignment,
);
