import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    authorName: { type: String, default: "" },
    content: { type: String, required: true }
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    authorName: { type: String, default: "" },
    content: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    replies: [replySchema]
  },
  {
    timestamps: true,
    collection: "doc_comments"
  }
);

commentSchema.index({ docId: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", commentSchema);
