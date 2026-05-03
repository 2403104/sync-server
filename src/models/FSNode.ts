import mongoose, { Document, Schema } from "mongoose";

// Represents a single file or folder. Handles the recursive directory tree.
export interface IFSNode extends Document {
  workspaceId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  name: string;
  type: "folder" | "file";
  path: string;
  contentId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FSNodeSchema = new Schema<IFSNode>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["folder", "file"],
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      ref: "FileContent",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Load full file tree for a workspace
FSNodeSchema.index({ workspaceId: 1 });

// Recurse children of a folder
FSNodeSchema.index({ parentId: 1 });

// Fast lookup by path (prevents duplicate files at the same path)
FSNodeSchema.index({ workspaceId: 1, path: 1 }, { unique: true });

// Fast lookup by name across the entire workspace (Great for Ctrl+P search)
FSNodeSchema.index({ workspaceId: 1, name: 1 });

export default mongoose.model<IFSNode>("FSNode", FSNodeSchema);