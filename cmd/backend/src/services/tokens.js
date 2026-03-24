import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessTTL }
  );
}

export function createRefreshToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTTL
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
