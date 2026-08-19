import { Router } from "express";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import * as materialRequestsController from "./material-requests.controller";

export const materialRequestsRouter = Router();

materialRequestsRouter.use(authenticate);

// Cola de trabajo de Mercaderista/Administrador/Gerente.
materialRequestsRouter.get("/", authorize(...INVENTORY_ROLES), materialRequestsController.list);

// Historial propio: cualquier autenticado ve solo lo que el mismo pidio (el
// service filtra por requestedById, no hay authorize a nivel de ruta).
materialRequestsRouter.get("/mine", materialRequestsController.listMine);

// Crear un pedido: no esta en la lista original de rutas del pedido, pero
// sin esto no hay forma de que exista una solicitud que resolver — el modelo
// ya preveía "trabajador o supervisor que pide" (ver schema.prisma). Abierto
// a cualquier autenticado, igual que POST /time-entries: es autoservicio
// (siempre crea la solicitud a nombre de quien llama), no gestion ajena.
materialRequestsRouter.post("/", materialRequestsController.create);

materialRequestsRouter.patch("/:requestId/resolve", authorize(...INVENTORY_ROLES), materialRequestsController.resolve);
