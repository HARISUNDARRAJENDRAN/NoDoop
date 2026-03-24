import bcrypt from "bcryptjs";
import { Router } from "express";

import { conflict, unauthorized } from "../lib/AppError.js";
import { loginSchema, refreshSchema, registerSchema } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import {
  createAccessToken,
  createRefreshToken,
  sha256,
  verifyRefreshToken
} from "../services/tokens.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { email, name, password } = validate(registerSchema, req.body);

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) throw conflict("email already in use");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, name, passwordHash });

    res.status(201).json({
      id: user._id,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw unauthorized("invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized("invalid credentials");

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await Session.create({
      userId: user._id,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = validate(refreshSchema, req.body);

    const payload = verifyRefreshToken(refreshToken);
    const session = await Session.findOne({
      userId: payload.sub,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: { $gt: new Date() }
    });

    if (!session) throw unauthorized("invalid session");

    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized("user not found");

    const accessToken = createAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

export default router;
