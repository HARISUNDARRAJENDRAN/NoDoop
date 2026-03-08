import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import authRouter from "./routes/auth.js";
import docsRouter from "./routes/docs.js";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(env.corsOrigins);

  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "nodoop-backend" });
  });

  app.use("/auth", authRouter);
  app.use("/docs", docsRouter);

  app.use((err, _req, res, _next) => {
    const status = Number(err.statusCode) || 500;
    res.status(status).json({
      error: err.message || "internal server error"
    });
  });

  return app;
}
