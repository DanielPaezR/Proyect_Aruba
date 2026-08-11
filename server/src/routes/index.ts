import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { activitiesRouter } from "../modules/activities/activities.routes";
import { evidencesRouter } from "../modules/evidences/evidences.routes";
import { projectsRouter } from "../modules/projects/projects.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/activities", activitiesRouter);
apiRouter.use("/evidences", evidencesRouter);
