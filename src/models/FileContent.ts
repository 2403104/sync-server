import mongoose, { Document, Schema } from "mongoose";

// Will store the content of the file
export interface IFileContent extends Document {
  nodeId: mongoose.Types.ObjectId;
  content: string;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileContentSchema = new Schema<IFileContent>(
  {
    nodeId: {
      type: Schema.Types.ObjectId,
      ref: "FSNode",
      required: true,
    },
    content: {
      type: String,
      default: ""
    },
    hash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

FileContentSchema.index({ nodeId: 1 }, { unique: true });

export default mongoose.model<IFileContent>("FileContent", FileContentSchema);