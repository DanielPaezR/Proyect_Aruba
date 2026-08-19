import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as payrollController from "./payroll.controller";

// Liquidacion mensual (Modulo 2.3): mismo criterio de acceso que el resto de
// sueldo/pago de trabajadores (SalaryRaise, SalaryAdjustment) — solo
// Administrador/Gerente, y vive bajo la Feature USUARIOS (ver comentario en
// schema.prisma sobre que incluye esa seccion).
export const payrollRouter = Router();

payrollRouter.use(authenticate, requireFeature(Feature.USUARIOS), authorize(Role.ADMINISTRADOR, Role.GERENTE));

payrollRouter.post("/generate", payrollController.generate);
payrollRouter.get("/", payrollController.list);
payrollRouter.patch("/:id/mark-paid", payrollController.markPaid);
