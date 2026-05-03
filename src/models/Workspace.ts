import mongoose, { Document, Schema } from "mongoose";

// Root container for a project and master sync state
export interface IWorkspace extends Document {
  sessionKey: string;
  name: string;
  global_version: number;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    sessionKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    global_version: {
      type: Number,
      default: 1,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ sessionKey: 1 }); // Recommended: speeds up join_session queries

export default mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);