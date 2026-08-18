import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { activitiesRouter } from "../modules/activities/activities.routes";
import { clientsRouter } from "../modules/clients/clients.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { evidencesRouter } from "../modules/evidences/evidences.routes";
import { invoicesRouter } from "../modules/invoices/invoices.routes";
import { paymentsRouter } from "../modules/payments/payments.routes";
import { projectsRouter } from "../modules/projects/projects.routes";
import { pushRouter } from "../modules/push/push.routes";
import { settingsRouter } from "../modules/settings/settings.routes";
import { timeEntriesRouter } from "../modules/time-entries/time-entries.routes";
import { usersRouter } from "../modules/users/users.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/activities", activitiesRouter);
apiRouter.use("/evidences", evidencesRouter);
apiRouter.use("/invoices", invoicesRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/time-entries", timeEntriesRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/push", pushRouter);
apiRouter.use("/users", usersRouter);
