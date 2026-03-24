import { randomUUID } from "node:crypto";

export function requestId(req, _res, next) {
  req.id = req.headers["x-request-id"] || randomUUID();
  next();
}
