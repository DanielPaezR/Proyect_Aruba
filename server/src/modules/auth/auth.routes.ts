import { Router } from "express";
import { Feature, Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import { documentUpload, imageUpload } from "../../config/storage";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.patch("/me/locale", authenticate, authController.updateLocale);
authRouter.patch("/me/profile", authenticate, imageUpload.single("photo"), authController.updateProfile);
// Autoservicio: cambiar la propia contraseña, exige la actual (ver
// auth.service.ts changeOwnPassword). Distinto de /users/:userId/reset-password
// (ADMINISTRADOR/GERENTE restableciendo la de otro, sin pedir la actual).
authRouter.patch("/me/password", authenticate, authController.changePassword);
// Autoservicio de telefono/especialidades — JSON plano, distinto de
// /me/profile (multipart, telefono+foto). Ver comentario en auth.service.ts.
// Nada de /me* lleva requireFeature: es autoservicio basico que cualquier
// usuario autenticado necesita sin importar el estado de la seccion USUARIOS.
authRouter.patch("/me", authenticate, authController.updateMe);

// A partir de aca, todo lo que vive bajo /users (mas /users/locations en
// users.routes.ts) es la seccion "USUARIOS" del sistema de permisos — ver
// requireFeature.middleware.ts. Los /me* de arriba quedan fuera a proposito.

// Alta de usuarios: solo Administrador/Gerente (no hay auto-registro ni gestión por Supervisor).
authRouter.post(
  "/users",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.createUser,
);
// Listado: tambien el Supervisor — lo necesita de solo-lectura para asignar
// trabajadores a actividades (ProjectDetailPage), mismo criterio que
// /users/locations (lectura de equipo compartida, gestion sigue siendo de
// Administrador/Gerente). Mercaderista tambien lo necesita de solo-lectura
// para elegir a que trabajador asignar una herramienta (ToolAssignmentsPage)
// — el service ya le oculta hourlyRate igual que a Supervisor
// (requesterRole !== "ADMINISTRADOR" && requesterRole !== "GERENTE").
authRouter.get(
  "/users",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR, Role.MERCADERISTA),
  authController.listUsers,
);

// Edicion general (datos basicos + perfil laboral): solo Administrador/Gerente.
authRouter.patch(
  "/users/:userId",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.updateUser,
);

// Desactivar/reactivar: solo Administrador/Gerente. Nunca borra nada (ver auth.service.ts).
authRouter.patch(
  "/users/:userId/deactivate",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.deactivateUser,
);
authRouter.patch(
  "/users/:userId/reactivate",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.reactivateUser,
);

// Restablecer la contraseña de otro usuario (se le olvido la suya): solo
// Administrador/Gerente, sin pedir la contraseña actual.
authRouter.patch(
  "/users/:userId/reset-password",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.resetUserPassword,
);

// Foto de CUALQUIER trabajador, subida por un manager — distinto de
// /me/profile, que es la foto propia del usuario autenticado.
authRouter.patch(
  "/users/:userId/photo",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR),
  imageUpload.single("photo"),
  authController.updateUserPhoto,
);

// Documentos del trabajador: sin authorize() a nivel de ruta — el service
// decide (el propio dueño, o Administrador/Gerente/Supervisor para
// cualquiera; ni siquiera otro TRABAJADOR_CAMPO puede ver documentos ajenos).
// requireFeature igual va aca: no bloquea nunca a TRABAJADOR_CAMPO viendo
// sus propios documentos (ver requireFeature.middleware.ts), solo afecta a
// un manager gestionando documentos ajenos.
authRouter.post(
  "/users/:userId/documents",
  authenticate,
  requireFeature(Feature.USUARIOS),
  documentUpload.single("file"),
  authController.uploadWorkerDocument,
);
authRouter.get(
  "/users/:userId/documents",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authController.listWorkerDocuments,
);
authRouter.delete(
  "/users/:userId/documents/:documentId",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authController.deleteWorkerDocument,
);

// Perfil consolidado del trabajador: Administrador/Gerente y Supervisor,
// mismo criterio que el listado (overtimeHourlyRate/hourlyRate se ocultan
// para Supervisor adentro del service, no aca).
authRouter.get(
  "/users/:userId/profile",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR),
  authController.getWorkerProfile,
);

// Precio por hora e historial de aumentos: solo Administrador/Gerente.
authRouter.patch(
  "/users/:userId/hourly-rate",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.updateHourlyRate,
);
authRouter.get(
  "/users/:userId/salary-history",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.salaryHistory,
);

// Adelantos y descuentos: solo Administrador/Gerente, base para la
// liquidacion mensual (Modulo 2.3). DELETE es borrado real (no hay edicion),
// mismo criterio que ya usan con Payment — solo para corregir un registro
// mal ingresado.
authRouter.post(
  "/users/:userId/salary-adjustments",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.createSalaryAdjustment,
);
authRouter.get(
  "/users/:userId/salary-adjustments",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.listSalaryAdjustments,
);
authRouter.delete(
  "/users/:userId/salary-adjustments/:adjustmentId",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.deleteSalaryAdjustment,
);

// Puntaje mensual (bonos/descuentos por incidentes): solo Administrador/Gerente.
authRouter.post(
  "/users/:userId/score-events",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.createScoreEvent,
);
authRouter.get(
  "/users/:userId/score",
  authenticate,
  requireFeature(Feature.USUARIOS),
  authorize(Role.ADMINISTRADOR, Role.GERENTE),
  authController.monthlyScore,
);
