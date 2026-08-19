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

// Alta de usuarios: solo el Jefe (no hay auto-registro ni gestión por Supervisor).
authRouter.post("/users", authenticate, authorize(Role.JEFE), authController.createUser);
// Listado: tambien el Supervisor — lo necesita de solo-lectura para asignar
// trabajadores a actividades (ProjectDetailPage), mismo criterio que
// /users/locations (lectura de equipo compartida, gestion sigue siendo del Jefe).
// Mercaderista tambien lo necesita de solo-lectura para elegir a que
// trabajador asignar una herramienta (ToolAssignmentsPage) — el service ya
// le oculta hourlyRate igual que a Supervisor (requesterRole !== "JEFE").
authRouter.get(
  "/users",
  authenticate,
  authorize(Role.JEFE, Role.SUPERVISOR, Role.MERCADERISTA),
  authController.listUsers,
);

// Edicion general (campos de perfil laboral): solo el Jefe.
authRouter.patch("/users/:userId", authenticate, authorize(Role.JEFE), authController.updateUser);

// Perfil consolidado del trabajador: Jefe y Supervisor, mismo criterio que
// el listado (overtimeHourlyRate/hourlyRate se ocultan para Supervisor
// adentro del service, no aca).
authRouter.get(
  "/users/:userId/profile",
  authenticate,
  authorize(Role.JEFE, Role.SUPERVISOR),
  authController.getWorkerProfile,
);

// Precio por hora e historial de aumentos: solo el Jefe.
authRouter.patch(
  "/users/:userId/hourly-rate",
  authenticate,
  authorize(Role.JEFE),
  authController.updateHourlyRate,
);
authRouter.get(
  "/users/:userId/salary-history",
  authenticate,
  authorize(Role.JEFE),
  authController.salaryHistory,
);

// Puntaje mensual (bonos/descuentos por incidentes): solo el Jefe.
authRouter.post(
  "/users/:userId/score-events",
  authenticate,
  authorize(Role.JEFE),
  authController.createScoreEvent,
);
authRouter.get(
  "/users/:userId/score",
  authenticate,
  authorize(Role.JEFE),
  authController.monthlyScore,
);
