import { Router } from "express";

import { badRequest, notFound } from "../lib/AppError.js";
import {
  createDocSchema,
  docPreferencesSchema,
  inviteDocSchema,
  objectIdSchema,
  saveDocSchema,
  shareDocSchema,
  transferOwnershipSchema,
  updateCollaboratorRoleSchema
} from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDocAccess } from "../middleware/require-doc-access.js";
import { DocVersion } from "../models/DocVersion.js";
import { Document } from "../models/Document.js";
import { Permission } from "../models/Permission.js";
import { User } from "../models/User.js";
import { getBlob } from "../services/dfs-client.js";
import { persistDocumentVersion } from "../services/doc-storage.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const { title } = validate(createDocSchema, req.body);
    const ownerId = req.auth.userId;

    const document = await Document.create({ title: title.trim(), ownerId });
    await Permission.create({
      docId: document._id,
      userId: ownerId,
      role: "owner"
    });

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
    const permissions = await Permission.find({
      userId: req.auth.userId
    }).lean();
    const docIds = permissions.map((p) => p.docId);

    const query = {
      _id: { $in: docIds },
      archivedAt: null
    };

    const search = String(req.query.q || "").trim();
    if (search) {
      query.$text = { $search: search };
    }

    const docs = await Document.find(query)
      .sort({ updatedAtLogical: -1 })
      .lean();

    const roleMap = new Map(
      permissions.map((p) => [String(p.docId), p.role])
    );

    res.json(
      docs.map((doc) => ({
        id: doc._id,
        title: doc.title,
        role: roleMap.get(String(doc._id)),
        latestVersionId: doc.latestVersionId,
        updatedAt: doc.updatedAtLogical,
        starred: (doc.starredBy || []).some(
          (uid) => String(uid) === String(req.auth.userId)
        ),
        pinned: (doc.pinnedBy || []).some(
          (uid) => String(uid) === String(req.auth.userId)
        )
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireDocAccess("viewer"), async (req, res, next) => {
  try {
    const docId = validate(objectIdSchema, req.params.id);
    const doc = await Document.findById(docId).lean();
    if (!doc) throw notFound("document not found");

    let latest = null;
    let payloadBase64 = null;

    if (doc.latestVersionId) {
      latest = await DocVersion.findOne({
        docId,
        versionId: doc.latestVersionId
      }).lean();
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

router.post(
  "/:id/save",
  requireDocAccess("editor"),
  async (req, res, next) => {
    try {
      const docId = validate(objectIdSchema, req.params.id);
      const { payloadBase64, parentVersionId } = validate(
        saveDocSchema,
        req.body
      );

      const payload = Buffer.from(payloadBase64, "base64");
      const version = await persistDocumentVersion({
        docId,
        authorId: req.auth.userId,
        payload,
        parentVersionId
      });

      res.status(201).json({
        versionId: version.versionId,
        dfsKey: version.dfsKey,
        checksum: version.checksum
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id/versions",
  requireDocAccess("viewer"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);

      const versions = await DocVersion.find({ docId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json(
        versions.map((v) => ({
          versionId: v.versionId,
          parentVersionId: v.parentVersionId,
          dfsKey: v.dfsKey,
          checksum: v.checksum,
          size: v.size,
          authorId: v.authorId,
          createdAt: v.createdAt
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id/history",
  requireDocAccess("viewer"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);

      const versions = await DocVersion.find({ docId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const authorIds = [...new Set(versions.map((v) => String(v.authorId)))];
      const users = await User.find({ _id: { $in: authorIds } }).lean();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      res.json(
        versions.map((v) => {
          const author = userMap.get(String(v.authorId));
          return {
            versionId: v.versionId,
            parentVersionId: v.parentVersionId,
            checksum: v.checksum,
            size: v.size,
            authorId: v.authorId,
            authorName: author?.name || author?.email || "Unknown",
            createdAt: v.createdAt
          };
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/restore",
  requireDocAccess("editor"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const { versionId } = req.body;
      if (!versionId) throw badRequest("versionId is required");

      const version = await DocVersion.findOne({
        docId: req.params.id,
        versionId
      }).lean();
      if (!version) throw notFound("version not found");

      const payload = await getBlob(version.dfsKey);

      const restored = await persistDocumentVersion({
        docId: req.params.id,
        authorId: req.auth.userId,
        payload,
        parentVersionId: versionId
      });

      res.status(201).json({
        versionId: restored.versionId,
        restoredFrom: versionId,
        checksum: restored.checksum
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id",
  requireDocAccess("editor"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const title = String(req.body.title || "").trim();
      if (!title) throw badRequest("title is required");

      const doc = await Document.findByIdAndUpdate(
        req.params.id,
        { $set: { title, updatedAtLogical: new Date() } },
        { new: true }
      );
      if (!doc) throw notFound("document not found");

      res.json({ id: doc._id, title: doc.title });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);

      await Document.findByIdAndUpdate(req.params.id, {
        $set: {
          archivedAt: new Date(),
          updatedAtLogical: new Date()
        }
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/share",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const { userId, role } = validate(shareDocSchema, req.body);

      await Permission.updateOne(
        { docId: req.params.id, userId },
        { $set: { role } },
        { upsert: true }
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/invite",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const { email, role } = validate(inviteDocSchema, req.body);

      const targetUser = await User.findOne({ email: email.toLowerCase() }).lean();
      if (!targetUser) throw notFound("user not found with that email");
      if (String(targetUser._id) === String(req.auth.userId)) {
        throw badRequest("owner already has access");
      }

      await Permission.updateOne(
        { docId: req.params.id, userId: targetUser._id },
        { $set: { role } },
        { upsert: true }
      );

      res.status(201).json({
        userId: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        role
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/preferences",
  requireDocAccess("viewer"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const preferences = validate(docPreferencesSchema, req.body);

      const userId = req.auth.userId;
      const update = {};

      if (preferences.starred !== undefined) {
        if (preferences.starred) {
          update.$addToSet = { ...(update.$addToSet || {}), starredBy: userId };
        } else {
          update.$pull = { ...(update.$pull || {}), starredBy: userId };
        }
      }

      if (preferences.pinned !== undefined) {
        if (preferences.pinned) {
          update.$addToSet = { ...(update.$addToSet || {}), pinnedBy: userId };
        } else {
          update.$pull = { ...(update.$pull || {}), pinnedBy: userId };
        }
      }

      update.$set = { ...(update.$set || {}), updatedAtLogical: new Date() };

      const doc = await Document.findByIdAndUpdate(req.params.id, update, {
        new: true
      }).lean();
      if (!doc) throw notFound("document not found");

      res.json({
        id: doc._id,
        starred: (doc.starredBy || []).some((uid) => String(uid) === String(userId)),
        pinned: (doc.pinnedBy || []).some((uid) => String(uid) === String(userId))
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/collaborators/:userId",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      validate(objectIdSchema, req.params.userId);
      const { role } = validate(updateCollaboratorRoleSchema, req.body);

      const doc = await Document.findById(req.params.id).lean();
      if (!doc) throw notFound("document not found");
      if (String(doc.ownerId) === req.params.userId) {
        throw badRequest("cannot change owner role");
      }

      const updated = await Permission.findOneAndUpdate(
        { docId: req.params.id, userId: req.params.userId },
        { $set: { role } },
        { new: true }
      ).lean();

      if (!updated) throw notFound("collaborator not found");

      res.json({
        userId: updated.userId,
        role: updated.role
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id/collaborators",
  requireDocAccess("viewer"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);

      const perms = await Permission.find({ docId: req.params.id }).lean();
      const userIds = perms.map((p) => p.userId);
      const users = await User.find({ _id: { $in: userIds } }).lean();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      res.json(
        perms.map((p) => {
          const u = userMap.get(String(p.userId));
          return {
            userId: p.userId,
            email: u?.email || "",
            name: u?.name || "",
            role: p.role
          };
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/collaborators/:userId",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      validate(objectIdSchema, req.params.userId);

      const doc = await Document.findById(req.params.id).lean();
      if (!doc) throw notFound("document not found");
      if (String(doc.ownerId) === req.params.userId) {
        throw badRequest("cannot remove the document owner");
      }

      await Permission.deleteOne({
        docId: req.params.id,
        userId: req.params.userId
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/transfer-ownership",
  requireDocAccess("owner"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      const { userId } = validate(transferOwnershipSchema, req.body);

      const doc = await Document.findById(req.params.id);
      if (!doc) throw notFound("document not found");
      if (String(doc.ownerId) === userId) {
        throw badRequest("user is already owner");
      }

      const targetPerm = await Permission.findOne({
        docId: req.params.id,
        userId
      });
      if (!targetPerm) {
        throw badRequest("target user must already have access");
      }

      const currentOwnerId = String(doc.ownerId);

      doc.ownerId = userId;
      doc.updatedAtLogical = new Date();

      await Promise.all([
        doc.save(),
        Permission.updateOne(
          { docId: req.params.id, userId: currentOwnerId },
          { $set: { role: "editor" } }
        ),
        Permission.updateOne(
          { docId: req.params.id, userId },
          { $set: { role: "owner" } }
        )
      ]);

      res.json({
        docId: req.params.id,
        previousOwnerId: currentOwnerId,
        ownerId: userId
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
