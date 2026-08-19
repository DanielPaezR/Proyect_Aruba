import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { invoiceUpload } from "../../config/storage";
import * as invoicesController from "./invoices.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];
// Restriccion de dinero: Supervisor conserva solo lectura (ver historial),
// nunca sube ni resube una factura — eso queda exclusivo de
// Administrador/Gerente (igual que aprobar/devolver, que ya era asi).
const ADMIN_ROLES = [Role.ADMINISTRADOR, Role.GERENTE];

/** Se monta anidado en /api/projects/:projectId/invoices */
export const projectInvoicesRouter = Router({ mergeParams: true });

projectInvoicesRouter.use(authenticate);
projectInvoicesRouter.get("/", authorize(...MANAGERS), invoicesController.listForProject);
projectInvoicesRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  invoiceUpload.single("file"),
  invoicesController.upload,
);

/** Se monta en /api/invoices */
export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

// Cola de revision: solo Administrador/Gerente.
invoicesRouter.get("/", authorize(...ADMIN_ROLES), invoicesController.listAll);
invoicesRouter.patch("/:invoiceId/approve", authorize(...ADMIN_ROLES), invoicesController.approve);
invoicesRouter.patch("/:invoiceId/return", authorize(...ADMIN_ROLES), invoicesController.returnInvoice);

// Resubir la correccion: exclusivo de Administrador/Gerente — Supervisor ya
// no gestiona dinero (ver restriccion arriba).
invoicesRouter.patch(
  "/:invoiceId/resubmit",
  authorize(...ADMIN_ROLES),
  invoiceUpload.single("file"),
  invoicesController.resubmit,
);
