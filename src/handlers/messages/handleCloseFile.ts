import { ConnectedUser, userLeavesFile, getFileViewers } from "../../session/sessionManager";
import { sendError, broadcastSessionState } from "../../broadcast";
import { getNodeByPath } from "../../db/operation";
import engine from "../../engine";
import { unregisterFileInDirtyTracker } from "../../timers/dirtyTracker";

export async function handleCloseFile(user: ConnectedUser, message: {filePath: string}) : Promise<void> {
  const {sessionKey, workspaceId, username} = user;
  const {filePath} = message;
  if(!filePath) {
    sendError(user.ws, "MISSING_PATH", "FILE_CLOSE requires path.");
    return;  
  }
  const node = await getNodeByPath(workspaceId, filePath);
  if(!node) {
    return;
  }
  const fileId = node._id.toString();
  try {
    engine.clearViewer(sessionKey, fileId, username);
    if(engine.getModifyingUser(sessionKey, fileId) === username) {
      engine.clearModifyingUser(sessionKey, fileId);
    }
  } catch (err: any) {
    // file is already closed
  }

  userLeavesFile(sessionKey, user.userId, fileId);
  const remainViewers = getFileViewers(sessionKey, fileId);
  if(remainViewers.length === 0) {
    try {
      unregisterFileInDirtyTracker(sessionKey, fileId);
      engine.closeFile(sessionKey, fileId);
    } catch (err: any) {
      // Already closed
    }
  }
  try {
    broadcastSessionState(sessionKey, engine.getAllFileStates(sessionKey));
  } catch (err: any) {
    
  }
  console.log(
    `[CloseFile] ${username} closed ${filePath} in session ${sessionKey}`
  );
}