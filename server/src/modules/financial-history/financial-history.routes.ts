import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as financialHistoryController from "./financial-history.controller";

// Vista consolidada de Payment + PayrollRun (Modulo 2.5): junta datos de
// sueldo con datos de cliente, asi que a proposito NO lleva requireFeature —
// no encaja en ninguna Feature individual (CLIENTES/USUARIOS por separado
// mostrarian solo la mitad). Queda condicionado unicamente al rol, mismo
// authorize directo que payroll.routes.ts.
export const financialHistoryRouter = Router();

financialHistoryRouter.use(authenticate, authorize(Role.ADMINISTRADOR, Role.GERENTE));

financialHistoryRouter.get("/", financialHistoryController.getHistory);
