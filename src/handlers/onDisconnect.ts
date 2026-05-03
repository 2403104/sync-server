import { WebSocket } from "ws";
import { removeUser, isSessionEmpty, getUserCurrentFile } from "../session/sessionManager";
import { removeActiveUser } from "../db/operation";
import { broadcastSessionState, broadcastTotalActiveUsers } from "../broadcast";
import { getUserFromWs, joinUserNameAndMachineId, getUserCurrentFileBeforeRemoval } from "../session/sessionManager";
import engine from "../engine/index"

export async function onDisconnect(ws: WebSocket) : Promise<void> {
  try {
    const preRemoval = getUserCurrentFileBeforeRemoval(ws);
    const user = removeUser(ws);
    if(!user) return;
    
    const sessionKey = user.sessionKey;
    const userId = user.userId;
    const workspaceId = user.workspaceId;
    const username = user.username;
    
    if(preRemoval?.fileId) {
      try {
        engine.clearViewer(sessionKey, preRemoval.fileId, username);
        if(engine.getModifyingUser(sessionKey, preRemoval.fileId) === username) {
          engine.clearModifyingUser(sessionKey, preRemoval.fileId);
        }
      } catch (err: any) {
        console.warn(`[Disconnect] Engine lock cleanup warning: ${err.message}`);
      }
    }
    await removeActiveUser(workspaceId, userId);
    try {
      const fileStates = engine.getAllFileStates(sessionKey);
      broadcastSessionState(sessionKey, fileStates);
      broadcastTotalActiveUsers(sessionKey);
      if(isSessionEmpty(sessionKey)) {
        try {
          engine.closeSession(sessionKey);
        } catch (err: any) {
          console.warn(`[Disconnect] Engine closeSession warning: ${err.message}`);
        }
      }
      console.log(`[Disconnect] User ${username} left session ${sessionKey}`);
    } catch (err: any) {
      console.error(`[Disconnect] Cleanup error: ${err.message}`);
    }
  } catch (err: any) {
    console.error("[Disconnect] error:", err.message);
  }
}