import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { activitiesRouter } from "../modules/activities/activities.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { evidencesRouter } from "../modules/evidences/evidences.routes";
import { projectsRouter } from "../modules/projects/projects.routes";
import { timeEntriesRouter } from "../modules/time-entries/time-entries.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/activities", activitiesRouter);
apiRouter.use("/evidences", evidencesRouter);
apiRouter.use("/time-entries", timeEntriesRouter);
apiRouter.use("/dashboard", dashboardRouter);
