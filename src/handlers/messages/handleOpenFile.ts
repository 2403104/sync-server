import { ConnectedUser, userEntersFile, joinPathSessionKey } from "../../session/sessionManager";
import { getOrCreateFileNodeByPath, loadFileContent } from "../../db/operation";

import { sendFileSync, sendError, broadcastSessionState } from "../../broadcast";
import engine from "../../engine/index";
import { registerFileInDirtyTracker } from "../../timers/dirtyTracker";

export async function handleOpenFile(user: ConnectedUser, message: {filePath: string}) : Promise<void> {
  const {sessionKey, workspaceId, username} = user;
  const {filePath} = message;
  if(!filePath) {
    sendError(user.ws, "MISSING_PATH", "FILE_OPEN requires path.");
    return;  
  }
  const node = await getOrCreateFileNodeByPath(workspaceId, filePath);
  if(!node) {
    sendError(user.ws, "FILE_NOT_FOUND", `File not found: ${filePath}`);
    return;
  }

  if(node.type != "file") {
    sendError(user.ws, "NOT_A_FILE", `Path is not a file: ${filePath}`);
    return;
  }
  
  const fileId = node._id.toString();
  const alreadyOpen = engine.isFileOpen(sessionKey, fileId);
  if(!alreadyOpen) {
    registerFileInDirtyTracker(sessionKey, fileId);
    const content = await loadFileContent(fileId);
    engine.openFile(sessionKey, fileId, filePath, content);
    userEntersFile(sessionKey, user.userId, fileId, filePath);
  }
  try {
    engine.setViewer(sessionKey, fileId, username);
  } catch (err: any) {
    
  }
  try {
    const fileStates = engine.getAllFileStates(sessionKey);
    broadcastSessionState(sessionKey, fileStates);
  } catch (err: any) {
    broadcastSessionState(sessionKey, []);
  }
  console.log(
    `[OpenFile] ${username} viewing ${filePath} in session ${sessionKey}`
  );
}