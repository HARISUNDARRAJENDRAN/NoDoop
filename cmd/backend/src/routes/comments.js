import { Router } from "express";
import { z } from "zod";

import { notFound } from "../lib/AppError.js";
import { objectIdSchema } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDocAccess } from "../middleware/require-doc-access.js";
import { Comment } from "../models/Comment.js";

const createCommentSchema = z.object({
  content: z.string().min(1, "content is required").max(5000)
});

const replySchema = z.object({
  content: z.string().min(1, "content is required").max(5000)
});

const router = Router();

router.use(requireAuth);

router.get("/:id/comments", requireDocAccess("viewer"), async (req, res, next) => {
  try {
    validate(objectIdSchema, req.params.id);

    const comments = await Comment.find({ docId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/comments", requireDocAccess("editor"), async (req, res, next) => {
  try {
    validate(objectIdSchema, req.params.id);
    const { content } = validate(createCommentSchema, req.body);

    const comment = await Comment.create({
      docId: req.params.id,
      authorId: req.auth.userId,
      authorName: req.auth.name || "",
      content
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/comments/:commentId/replies",
  requireDocAccess("editor"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      validate(objectIdSchema, req.params.commentId);
      const { content } = validate(replySchema, req.body);

      const comment = await Comment.findOneAndUpdate(
        { _id: req.params.commentId, docId: req.params.id },
        {
          $push: {
            replies: {
              authorId: req.auth.userId,
              authorName: req.auth.name || "",
              content
            }
          }
        },
        { new: true }
      );

      if (!comment) throw notFound("comment not found");
      res.json(comment);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/comments/:commentId/resolve",
  requireDocAccess("editor"),
  async (req, res, next) => {
    try {
      validate(objectIdSchema, req.params.id);
      validate(objectIdSchema, req.params.commentId);

      const comment = await Comment.findOneAndUpdate(
        { _id: req.params.commentId, docId: req.params.id },
        { $set: { resolved: true } },
        { new: true }
      );

      if (!comment) throw notFound("comment not found");
      res.json(comment);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
