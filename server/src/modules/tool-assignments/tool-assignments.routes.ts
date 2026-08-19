import { Router } from "express";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import * as toolAssignmentsController from "./tool-assignments.controller";

export const toolAssignmentsRouter = Router();

toolAssignmentsRouter.use(authenticate, authorize(...INVENTORY_ROLES));

// GET no estaba en la lista original de rutas del pedido, pero sin ella no
// hay forma de mostrar en el cliente que herramienta tiene cada quien para
// poder marcarla como devuelta.
toolAssignmentsRouter.get("/", toolAssignmentsController.list);
toolAssignmentsRouter.post("/", toolAssignmentsController.create);
toolAssignmentsRouter.patch("/:assignmentId/return", toolAssignmentsController.returnAssignment);
