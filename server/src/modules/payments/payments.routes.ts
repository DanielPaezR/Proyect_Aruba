import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as paymentsController from "./payments.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];
// Restriccion de dinero: Supervisor conserva solo lectura (ver historial),
// nunca crea ni toca pagos — eso queda exclusivo de Administrador/Gerente.
const ADMIN_ROLES = [Role.ADMINISTRADOR, Role.GERENTE];

/** Se monta anidado en /api/projects/:projectId/payments */
export const projectPaymentsRouter = Router({ mergeParams: true });

projectPaymentsRouter.use(authenticate, requireFeature(Feature.CLIENTES));
projectPaymentsRouter.get("/", authorize(...MANAGERS), paymentsController.listForProject);
projectPaymentsRouter.post("/", authorize(...ADMIN_ROLES), paymentsController.create);

/** Se monta anidado en /api/clients/:clientId/payments */
export const clientPaymentsRouter = Router({ mergeParams: true });

clientPaymentsRouter.use(authenticate, requireFeature(Feature.CLIENTES), authorize(...MANAGERS));
clientPaymentsRouter.get("/", paymentsController.listForClient);

/** Se monta en /api/payments */
export const paymentsRouter = Router();

paymentsRouter.use(authenticate, requireFeature(Feature.CLIENTES));
// Borrado: solo Administrador/Gerente, para corregir un registro mal ingresado — sin
// edicion auditada de montos en esta primera version.
paymentsRouter.delete("/:paymentId", authorize(...ADMIN_ROLES), paymentsController.remove);
