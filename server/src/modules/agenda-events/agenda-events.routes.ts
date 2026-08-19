import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as agendaEventsController from "./agenda-events.controller";

const MANAGERS = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

export const agendaEventsRouter = Router();

agendaEventsRouter.use(authenticate, authorize(...MANAGERS));

agendaEventsRouter.get("/", agendaEventsController.list);
agendaEventsRouter.post("/", agendaEventsController.create);
// Sin authorize adicional a nivel de ruta: el service decide (creador propio, o Administrador/Gerente).
agendaEventsRouter.patch("/:eventId", agendaEventsController.update);
agendaEventsRouter.delete("/:eventId", agendaEventsController.remove);
