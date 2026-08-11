import path from "node:path";
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
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Fotos de evidencias servidas como archivos estáticos (nombres aleatorios, sin listado de directorio).
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
