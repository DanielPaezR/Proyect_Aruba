import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { imageUpload } from "../../config/storage";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.patch("/me/locale", authenticate, authController.updateLocale);
authRouter.patch("/me/profile", authenticate, imageUpload.single("photo"), authController.updateProfile);

// Alta y listado de usuarios: solo el Jefe (no hay auto-registro ni gestión por Supervisor).
authRouter.post("/users", authenticate, authorize(Role.JEFE), authController.createUser);
authRouter.get("/users", authenticate, authorize(Role.JEFE), authController.listUsers);
