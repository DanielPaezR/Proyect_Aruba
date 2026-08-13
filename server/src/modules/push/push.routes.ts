import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import * as pushController from "./push.controller";

export const pushRouter = Router();

pushRouter.use(authenticate);
pushRouter.post("/subscribe", pushController.subscribe);
