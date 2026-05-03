// import {createClient} from "redis";
// import config from "../config";

// const redisConfig = {
//   socket : {
//     host: config.redis.host,
//     port: config.redis.port,

//     reconnectStrategy: (retries: number) => {
//       if(retries > 10) {
//         console.log("[Redis] Too many reconnect attempts. Giving up.");
//         return new Error("Redis reconnect limit reached.");
//       }
//       const delay = Math.min(retries * 50, 10000);
//       console.log(`[Redis] Reconnecting in ${delay}ms...`);
//       return delay;
//     },
//   },
//   ...(config.redis.password && {password: config.redis.password}),
// };

// export const publisher = createClient(redisConfig);
// export const subscriber = createClient(redisConfig);

// export async function connectRedis() : Promise<void> {
//   try {
//     await publisher.connect();
//     console.log("[Redis] Publisher connected.");
    
//     publisher.on("error", (err : any) =>
//       console.error("[Redis] Publisher error:", err.message)
//     );

//     await subscriber.connect();
//     console.log("[Redis] Subscriber connected.");

//     subscriber.on("error", (err : any) =>
//       console.error("[Redis] Subscriber error:", err.message)
//     );

//   } catch (err: any) {
//     console.error("[Redis] Connection failed:", err.message);
//     process.exit(1);
//   }
// }


// export async function disconnectRedis(): Promise<void> {
//   await publisher.quit();
//   await subscriber.quit();
//   console.log("[Redis] Both clients disconnected cleanly.");
// }