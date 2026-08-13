import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as timeEntriesController from "./time-entries.controller";

const MANAGERS = [Role.JEFE, Role.SUPERVISOR];

export const timeEntriesRouter = Router();

timeEntriesRouter.use(authenticate);
timeEntriesRouter.post("/", timeEntriesController.create);
timeEntriesRouter.post("/auto-check", timeEntriesController.autoCheck);
timeEntriesRouter.get("/mine", timeEntriesController.listMine);
timeEntriesRouter.get("/", authorize(...MANAGERS), timeEntriesController.list);
