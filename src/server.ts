import http from "http"
import express from "express"
import {WebSocketServer, WebSocket} from "ws"

import { onConnection } from "./handlers/onConnection"
import { onDisconnect } from "./handlers/onDisconnect"
import { onLiveMessage } from "./handlers/onLiveMessage"

import { getUserFromWs } from "./session/sessionManager"
import { connectMongo } from "./db/mongo"
// import { connectRedis } from "./db/redis"
import { handleWsSyncRequest } from "./handlers/syncHandler"

const PORT = process.env.PORT || 8080;
const app = express();

app.get("/health", (req, res) => {
  res.status(200).send("OK");
})

const server = http.createServer(app);
const liveWss = new WebSocketServer({ noServer: true, perMessageDeflate: false});
const syncWss = new WebSocketServer({ noServer: true, perMessageDeflate: false});

server.on("upgrade", (req, socket, head) => {
  const pathname = req.url ? req.url.split('?')[0] : "";
  console.log("[Upgrade] pathname:", req.url?.split('?')[0]);
  if(pathname === "/live") {
    liveWss.handleUpgrade(req, socket, head, (ws) => {
      liveWss.emit("connection", ws, req);
    });
  } else if(pathname === "/sync") {
    syncWss.handleUpgrade(req, socket, head, (ws) => {
      syncWss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
})

liveWss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
  try {
    await onConnection(ws, req);
    if(ws.readyState == WebSocket.CLOSING || ws.readyState == WebSocket.CLOSED) {
      return;
    }
    ws.on("message", async(data: any) => {
      const connectedUser = getUserFromWs(ws);
      if(connectedUser) {
        await onLiveMessage(connectedUser, data); 
      } else {
        console.warn("[Server] Received message from an unregistered socket.");
      }
    });
    
    ws.on("close", async() => {
      await onDisconnect(ws);
    });

    ws.on("error", async() => {
      await onDisconnect(ws);
    });
  } catch (err: any) {
    console.error("[Server] Critical error during connection:", err);
    ws.close(1011, "Internal Server Error");
  }
});

syncWss.on("connection", (ws: WebSocket) => {
  console.log("[Sync WS] Client connected to /sync endpoint");

  ws.on("message", async(data: any) => {
    try {
      const message = JSON.parse(data.toString());
      if(message.type === "SYNC_REQUEST") {
        await handleWsSyncRequest(ws, message);
      }
    } catch (err) {
      console.error("[Sync WS] Error processing sync message:", err);
    }
  });
});

async function bootstrap(): Promise<void>  {
  await connectMongo();
  // await connectRedis();
  // server.listen(PORT, () => {
  //   console.log(`[Server] Listening on port ${PORT}`);
  // });
  server.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
    console.log(`[Server] Listening on port ${PORT}`);
    console.log(`[Server] Live WS endpoint: ws://localhost:${PORT}/live`);
    console.log(`[Server] Sync WS endpoint: ws://localhost:${PORT}/sync`);
  });
  const shutdown = async (signal : string) => {
    console.log(`[Server] ${signal} — shutting down...`);
    liveWss.close();
    syncWss.close();
    server.close();
    process.exit(0);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[Server] Bootstrap failed:", err.message);
  process.exit(1);
})
