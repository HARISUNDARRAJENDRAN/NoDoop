import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { AppError } from "./lib/AppError.js";
import { apiLimiter, authLimiter } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import authRouter from "./routes/auth.js";
import commentsRouter from "./routes/comments.js";
import docsRouter from "./routes/docs.js";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(env.corsOrigins);

  app.use(requestId);
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
  app.use(
    morgan((tokens, req, res) => {
      return [
        `[${req.id}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens["response-time"](req, res),
        "ms"
      ].join(" ");
    })
  );

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "nodoop-backend" });
  });

  app.use("/auth", authLimiter, authRouter);
  app.use("/docs", apiLimiter, docsRouter);
  app.use("/docs", apiLimiter, commentsRouter);

  app.use((err, req, res, _next) => {
    const status =
      err instanceof AppError
        ? err.statusCode
        : Number(err.statusCode) || 500;
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

    if (status >= 500) {
      console.error(`[${req.id}] ${err.stack || err.message}`);
    }

    res.status(status).json({
      error: err.message || "internal server error",
      code,
      requestId: req.id
    });
  });

  return app;
}
