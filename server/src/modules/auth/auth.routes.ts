import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { documentUpload, imageUpload } from "../../config/storage";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.patch("/me/locale", authenticate, authController.updateLocale);
authRouter.patch("/me/profile", authenticate, imageUpload.single("photo"), authController.updateProfile);
// Autoservicio de telefono/especialidades — JSON plano, distinto de
// /me/profile (multipart, telefono+foto). Ver comentario en auth.service.ts.
authRouter.patch("/me", authenticate, authController.updateMe);

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

// Edicion general (datos basicos + perfil laboral): solo el Jefe.
authRouter.patch("/users/:userId", authenticate, authorize(Role.JEFE), authController.updateUser);

// Desactivar/reactivar: solo el Jefe. Nunca borra nada (ver auth.service.ts).
authRouter.patch(
  "/users/:userId/deactivate",
  authenticate,
  authorize(Role.JEFE),
  authController.deactivateUser,
);
authRouter.patch(
  "/users/:userId/reactivate",
  authenticate,
  authorize(Role.JEFE),
  authController.reactivateUser,
);

// Foto de CUALQUIER trabajador, subida por un manager — distinto de
// /me/profile, que es la foto propia del usuario autenticado.
authRouter.patch(
  "/users/:userId/photo",
  authenticate,
  authorize(Role.JEFE, Role.SUPERVISOR),
  imageUpload.single("photo"),
  authController.updateUserPhoto,
);

// Documentos del trabajador: sin authorize() a nivel de ruta — el service
// decide (el propio dueño, o Jefe/Supervisor para cualquiera; ni siquiera
// otro TRABAJADOR_CAMPO puede ver documentos ajenos).
authRouter.post(
  "/users/:userId/documents",
  authenticate,
  documentUpload.single("file"),
  authController.uploadWorkerDocument,
);
authRouter.get("/users/:userId/documents", authenticate, authController.listWorkerDocuments);
authRouter.delete(
  "/users/:userId/documents/:documentId",
  authenticate,
  authController.deleteWorkerDocument,
);

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
