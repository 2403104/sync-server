import mongoose from "mongoose";
import config from "../config";

let isConnected  = false;

export async function connectMongo(): Promise<void> {
  if(isConnected) {
    console.log("[MongoDB] Already connected, skipping.");
    return;
  }
  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    isConnected = true;
    console.log("[MongoDB] Connected.");

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.log("[MongoDB] Disconnected.");
    });

    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      console.log("[MongoDB] Reconnected.");
    });
    
    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err.message);
    });
  } catch (err: any) {
    console.error("[MongoDB] Initial connection failed:", err.message);
    process.exit(1);
  }
}

export async function disconnectMongo() : Promise<void> {
  if(!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log("[MongoDB] Disconnected.");
}