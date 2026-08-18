import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { invoiceUpload } from "../../config/storage";
import * as invoicesController from "./invoices.controller";

const MANAGERS = [Role.JEFE, Role.SUPERVISOR];

/** Se monta anidado en /api/projects/:projectId/invoices */
export const projectInvoicesRouter = Router({ mergeParams: true });

projectInvoicesRouter.use(authenticate, authorize(...MANAGERS));
projectInvoicesRouter.get("/", invoicesController.listForProject);
projectInvoicesRouter.post("/", invoiceUpload.single("file"), invoicesController.upload);

/** Se monta en /api/invoices */
export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

// Cola de revision: solo el Jefe.
invoicesRouter.get("/", authorize(Role.JEFE), invoicesController.listAll);
invoicesRouter.patch("/:invoiceId/approve", authorize(Role.JEFE), invoicesController.approve);
invoicesRouter.patch("/:invoiceId/return", authorize(Role.JEFE), invoicesController.returnInvoice);

// Resubir la correccion: el Supervisor que la sube (o el Jefe, mismo criterio
// que el resto de acciones de gestion de facturas).
invoicesRouter.patch(
  "/:invoiceId/resubmit",
  authorize(...MANAGERS),
  invoiceUpload.single("file"),
  invoicesController.resubmit,
);
