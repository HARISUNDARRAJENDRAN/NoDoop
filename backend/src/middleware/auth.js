import { verifyAccessToken } from "../services/tokens.js";

export function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      const err = new Error("missing access token");
      err.statusCode = 401;
      throw err;
    }

    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name
    };

    next();
  } catch {
    const err = new Error("invalid access token");
    err.statusCode = 401;
    next(err);
  }
}
