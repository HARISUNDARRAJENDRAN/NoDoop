import bcrypt from "bcryptjs";
import { Router } from "express";

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
    const { email, name, password } = req.body;
    if (!email || !name || !password || password.length < 8) {
      const err = new Error("invalid registration payload");
      err.statusCode = 400;
      throw err;
    }

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) {
      const err = new Error("email already in use");
      err.statusCode = 409;
      throw err;
    }

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
    const { email, password } = req.body;
    if (!email || !password) {
      const err = new Error("invalid login payload");
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const err = new Error("invalid credentials");
      err.statusCode = 401;
      throw err;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const err = new Error("invalid credentials");
      err.statusCode = 401;
      throw err;
    }

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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      const err = new Error("missing refresh token");
      err.statusCode = 400;
      throw err;
    }

    const payload = verifyRefreshToken(refreshToken);
    const session = await Session.findOne({
      userId: payload.sub,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      const err = new Error("invalid session");
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      const err = new Error("user not found");
      err.statusCode = 404;
      throw err;
    }

    const accessToken = createAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

export default router;
