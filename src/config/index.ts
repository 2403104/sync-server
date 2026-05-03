import dotenv from "dotenv";
dotenv.config();

const config = {
  server: {
    port: parseInt(process.env.PORT || "8000", 10),
    env: process.env.NODE_ENV || "development",  
  },
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/syncdb",
  },
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  engine: {
    path: process.env.ENGINE_PATH || "../../cpp-engine/build/Release/engine.node",
    redisSnapshotInterval: parseInt(process.env.REDIS_SNAPSHOT_INTERVAL || "6000", 10),
    mongoSaveInterval: parseInt(process.env.MONGO_SAVE_INTERVAL || "10000", 10),
  },
  session: {
    keyTTL : parseInt(process.env.SESSION_KEY_TTL || "0", 10)
  }
} as const;

export default config;
