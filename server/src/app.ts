import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { apiRouter } from "./routes";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
// exposedHeaders: sin esto el navegador oculta Content-Disposition en
// respuestas cross-origin (client:5173 vs server:4000 en dev, o dominios
// distintos en prod) — el cliente lo necesita para nombrar el archivo
// descargado en /reports/export (ver reportExport.ts).
app.use(cors({ origin: env.corsOrigin, credentials: true, exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());
app.use(cookieParser());
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
