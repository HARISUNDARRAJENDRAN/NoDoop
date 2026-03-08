import mongoose from "mongoose";
import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { requireDocAccess } from "../middleware/require-doc-access.js";
import { DocVersion } from "../models/DocVersion.js";
import { Document } from "../models/Document.js";
import { Permission } from "../models/Permission.js";
import { getBlob } from "../services/dfs-client.js";
import { persistDocumentVersion } from "../services/doc-storage.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title || "Untitled document").trim();
    const ownerId = req.auth.userId;

    const document = await Document.create({ title, ownerId });
    await Permission.create({ docId: document._id, userId: ownerId, role: "owner" });

    res.status(201).json({
      id: document._id,
      title: document.title,
      latestVersionId: document.latestVersionId
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const permissions = await Permission.find({ userId: req.auth.userId }).lean();
    const docIds = permissions.map((entry) => entry.docId);

    const docs = await Document.find({ _id: { $in: docIds } })
      .sort({ updatedAtLogical: -1 })
      .lean();

    const roleMap = new Map(permissions.map((entry) => [String(entry.docId), entry.role]));

    res.json(
      docs.map((doc) => ({
        id: doc._id,
        title: doc.title,
        role: roleMap.get(String(doc._id)),
        latestVersionId: doc.latestVersionId,
        updatedAt: doc.updatedAtLogical
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireDocAccess("viewer"), async (req, res, next) => {
  try {
    const docId = req.params.id;
    const doc = await Document.findById(docId).lean();
    if (!doc) {
      const err = new Error("document not found");
      err.statusCode = 404;
      throw err;
    }

    let latest = null;
    let payloadBase64 = null;

    if (doc.latestVersionId) {
      latest = await DocVersion.findOne({ docId, versionId: doc.latestVersionId }).lean();
      if (latest) {
        const payload = await getBlob(latest.dfsKey);
        payloadBase64 = payload.toString("base64");
      }
    }

    res.json({
      id: doc._id,
      title: doc.title,
      latestVersionId: doc.latestVersionId,
      latest,
      payloadBase64
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/save", requireDocAccess("editor"), async (req, res, next) => {
  try {
    const docId = req.params.id;
    if (!mongoose.isValidObjectId(docId)) {
      const err = new Error("invalid doc id");
      err.statusCode = 400;
      throw err;
    }

    const payloadBase64 = String(req.body.payloadBase64 || "");
    if (!payloadBase64) {
      const err = new Error("payloadBase64 is required");
      err.statusCode = 400;
      throw err;
    }

    const payload = Buffer.from(payloadBase64, "base64");
    const version = await persistDocumentVersion({
      docId,
      authorId: req.auth.userId,
      payload,
      parentVersionId: req.body.parentVersionId || null
    });

    res.status(201).json({
      versionId: version.versionId,
      dfsKey: version.dfsKey,
      checksum: version.checksum
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/versions", requireDocAccess("viewer"), async (req, res, next) => {
  try {
    const versions = await DocVersion.find({ docId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(
      versions.map((entry) => ({
        versionId: entry.versionId,
        parentVersionId: entry.parentVersionId,
        dfsKey: entry.dfsKey,
        checksum: entry.checksum,
        size: entry.size,
        authorId: entry.authorId,
        createdAt: entry.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/:id/share", requireDocAccess("owner"), async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !["editor", "viewer"].includes(role)) {
      const err = new Error("invalid share payload");
      err.statusCode = 400;
      throw err;
    }

    await Permission.updateOne(
      { docId: req.params.id, userId },
      { $set: { role } },
      { upsert: true }
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
