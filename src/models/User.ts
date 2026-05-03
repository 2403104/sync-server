import mongoose, { Document, Schema } from "mongoose";

// Will store the identity of the user
export interface IUser extends Document {
  machineId: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    machineId: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ machineId: 1 });

export default mongoose.model<IUser>("User", UserSchema);