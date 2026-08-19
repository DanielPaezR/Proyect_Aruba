import { Router } from "express";
import { authenticate, authorize, INVENTORY_ROLES } from "../../middleware/auth.middleware";
import * as inventoryController from "./inventory.controller";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

// Lectura abierta a cualquier autenticado: Supervisor y Trabajador de Campo
// tambien necesitan ver el catalogo para saber que existe al pedir material.
inventoryRouter.get("/", inventoryController.list);

inventoryRouter.post("/", authorize(...INVENTORY_ROLES), inventoryController.create);
inventoryRouter.patch("/:itemId", authorize(...INVENTORY_ROLES), inventoryController.update);
inventoryRouter.delete("/:itemId", authorize(...INVENTORY_ROLES), inventoryController.remove);
