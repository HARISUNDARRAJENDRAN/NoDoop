import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["owner", "editor", "viewer"],
      required: true
    }
  },
  {
    timestamps: true,
    collection: "permissions"
  }
);

permissionSchema.index({ docId: 1, userId: 1 }, { unique: true });

export const Permission = mongoose.model("Permission", permissionSchema);
