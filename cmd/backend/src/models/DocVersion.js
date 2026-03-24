import mongoose from "mongoose";

const docVersionSchema = new mongoose.Schema(
  {
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true
    },
    versionId: {
      type: String,
      required: true
    },
    parentVersionId: {
      type: String,
      default: null
    },
    dfsKey: {
      type: String,
      required: true
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    checksum: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "doc_versions"
  }
);

docVersionSchema.index({ docId: 1, versionId: 1 }, { unique: true });
docVersionSchema.index({ docId: 1, createdAt: -1 });

export const DocVersion = mongoose.model("DocVersion", docVersionSchema);
