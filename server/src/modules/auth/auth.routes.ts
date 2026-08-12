import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.patch("/me/locale", authenticate, authController.updateLocale);

// Alta de usuarios: solo el Jefe puede crear cuentas (no hay auto-registro).
authRouter.post("/users", authenticate, authorize(Role.JEFE), authController.createUser);
