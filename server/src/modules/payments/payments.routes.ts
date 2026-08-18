import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as paymentsController from "./payments.controller";

const MANAGERS = [Role.JEFE, Role.SUPERVISOR];

/** Se monta anidado en /api/projects/:projectId/payments */
export const projectPaymentsRouter = Router({ mergeParams: true });

projectPaymentsRouter.use(authenticate, authorize(...MANAGERS));
projectPaymentsRouter.get("/", paymentsController.listForProject);
projectPaymentsRouter.post("/", paymentsController.create);

/** Se monta anidado en /api/clients/:clientId/payments */
export const clientPaymentsRouter = Router({ mergeParams: true });

clientPaymentsRouter.use(authenticate, authorize(...MANAGERS));
clientPaymentsRouter.get("/", paymentsController.listForClient);

/** Se monta en /api/payments */
export const paymentsRouter = Router();

paymentsRouter.use(authenticate);
// Borrado: solo el Jefe, para corregir un registro mal ingresado — sin
// edicion auditada de montos en esta primera version.
paymentsRouter.delete("/:paymentId", authorize(Role.JEFE), paymentsController.remove);
