import { Router } from "express";
import { Feature } from "@prisma/client";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import { requireFeature } from "../../middleware/requireFeature.middleware";
import * as inventoryController from "./inventory.controller";

export const inventoryRouter = Router();

// requireFeature no bloquea nunca a TRABAJADOR_CAMPO (ver
// requireFeature.middleware.ts), asi que la lectura abierta de mas abajo
// (Supervisor/Trabajador viendo el catalogo) sigue funcionando igual.
inventoryRouter.use(authenticate, requireFeature(Feature.INVENTARIO));

// Lectura abierta a cualquier autenticado: Supervisor y Trabajador de Campo
// tambien necesitan ver el catalogo para saber que existe al pedir material.
inventoryRouter.get("/", inventoryController.list);

inventoryRouter.post("/", authorize(...INVENTORY_ROLES), inventoryController.create);
inventoryRouter.patch("/:itemId", authorize(...INVENTORY_ROLES), inventoryController.update);
inventoryRouter.delete("/:itemId", authorize(...INVENTORY_ROLES), inventoryController.remove);
