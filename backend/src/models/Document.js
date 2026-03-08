import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    latestVersionId: {
      type: String,
      default: null
    },
    updatedAtLogical: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: "documents"
  }
);

documentSchema.index({ ownerId: 1, updatedAt: -1 });
documentSchema.index({ title: "text" });

export const Document = mongoose.model("Document", documentSchema);
