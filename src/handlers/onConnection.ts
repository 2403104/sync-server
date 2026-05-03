import { WebSocket } from "ws";
import { IncomingMessage } from "http";
import { randomUUID } from "crypto";

import { findOrCreateUser, addActiveUser, getWorkspaceBySessionKey, getFileTree} from '../db/operation'
import { addUser, ConnectedUser, joinUserNameAndMachineId } from "../session/sessionManager";
import { broadcastSessionState, broadcastTotalActiveUsers, send, sendError } from "../broadcast/index"

import Session from "../models/Session"; 
import Workspace from "../models/Workspace";
import engine from "../engine";

export async function onConnection(ws: WebSocket, req: IncomingMessage) : Promise<void> {
  try {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const action = url.searchParams.get("action");
    const machineId = url.searchParams.get("machineId");
    const username = url.searchParams.get("username");

    if(!action || !machineId || !username) {
      sendError(ws, "MISSING_PARAMS", "action, machineId, and username are required");
      ws.close();
      return;
    }

    const user = await findOrCreateUser(machineId, username);
    
    if(!user) {
      sendError(ws, "USER_ERROR", "Failed to find or create user");
      ws.close();
      return;
    }

    const userId = user._id.toString();

    let workspace;
    let activeSessionKey; 

    if(action == "new_session") {
      const workspaceName = url.searchParams.get("workspaceName");
      if(!workspaceName) {
        sendError(ws, "MISSING_PARAMS", "workspaceName is required");
        ws.close();
        return;
      }
      
      activeSessionKey = randomUUID();
      workspace = await Workspace.create({
        sessionKey: activeSessionKey,
        name: workspaceName,
        ownerId: user._id,
      });
      
      await Session.create({
        sessionKey: activeSessionKey,
        workspaceId: workspace._id,
        totalUsers: [userId]
      });

      ws.send(JSON.stringify({
        type: "NEW_SESSION_CREATED",
        sessionKey: activeSessionKey,
      }));
      
    } else if(action == "join_session") {
      const sessionKey = url.searchParams.get("sessionKey");
      
      if(!sessionKey) {
        sendError(ws, "MISSING_PARAMS", "sessionKey is required");
        ws.close();
        return;
      }
      
      workspace = await getWorkspaceBySessionKey(sessionKey);
      
      if(!workspace) {
        sendError(ws, "SESSION_NOT_FOUND", "Session not found");
        ws.close();
        return;
      }

      activeSessionKey = sessionKey;

      const sessionBeforeUpdate = await Session.findOneAndUpdate(
        { sessionKey },
        { $addToSet: { totalUsers: userId } },
        {new: false}      
      );

      send(ws, {
        type: "JOINED_EXISTING_SESSION",
        sessionKey: activeSessionKey
      });

    } else {
      sendError(ws, "INVALID_ACTION", "Invalid action");
      ws.close();
      return;
    }

    const workspaceId = workspace._id.toString();

    const connectedUser: ConnectedUser = {
      ws,
      userId, 
      username : joinUserNameAndMachineId(username, machineId),
      machineId,
      sessionKey: activeSessionKey, 
      workspaceId,
    }

    addUser(connectedUser);
    await addActiveUser(workspaceId, userId);
    
    if(action == "new_session") {
      
      broadcastSessionState(activeSessionKey, []);
      broadcastTotalActiveUsers(activeSessionKey);

    } else if(action == "join_session") {

      const fileStates = engine.getAllFileStates(activeSessionKey);
      console.log("[Sync] File states from the server sent:", JSON.stringify(fileStates));
      broadcastSessionState(activeSessionKey, fileStates);
      broadcastTotalActiveUsers(activeSessionKey);
    }

    console.log(`[Connection] User ${user.username} ${action === "new_session" ? "created" : "joined"} session ${activeSessionKey}`);

  } catch (err: any) {
    console.error("[Connection] Error:", err.message);
    ws.close();
  }
}