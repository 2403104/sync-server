import mongoose, { Document, Schema } from "mongoose";

// Tracks access, online status, and acts as the gateway via sessionKey
export interface ISession extends Document {
  sessionKey: string;
  workspaceId: mongoose.Types.ObjectId;
  totalUsers: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    sessionKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    totalUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ]
  },
  {
    timestamps: true,
  }
);

SessionSchema.index({ sessionKey: 1 }); 
SessionSchema.index({ workspaceId: 1 });

export default mongoose.model<ISession>("Session", SessionSchema);