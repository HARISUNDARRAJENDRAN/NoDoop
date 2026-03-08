import mongoose from "mongoose";

import { Permission } from "../models/Permission.js";

const hierarchy = {
  viewer: 1,
  editor: 2,
  owner: 3
};

export function requireDocAccess(minRole = "viewer") {
  return async function docAccessMiddleware(req, _res, next) {
    try {
      const { userId } = req.auth;
      const { id: docId } = req.params;

      if (!mongoose.isValidObjectId(docId)) {
        const err = new Error("invalid doc id");
        err.statusCode = 400;
        throw err;
      }

      const permission = await Permission.findOne({ docId, userId }).lean();
      if (!permission || hierarchy[permission.role] < hierarchy[minRole]) {
        const err = new Error("forbidden");
        err.statusCode = 403;
        throw err;
      }

      req.permission = permission;
      next();
    } catch (error) {
      next(error);
    }
  };
}
