import { ConnectedUser, getFileIdByPath } from "../../session/sessionManager";
import { sendError, broadcastSessionState } from "../../broadcast";
import engine from "../../engine/index"

export async function handleStartModifying(user: ConnectedUser, message: {filePath : string}) : Promise<void> {
  const {sessionKey, username} = user;
  const {filePath} = message;
  if(!filePath) {
    sendError(user.ws, "MISSING_FIELDS", "START_WORKING requires fileId.");
    return;
  }
  const fileId = getFileIdByPath(sessionKey, filePath);
  if(!fileId) {
    sendError(user.ws, "INVALID FILE_ID", "There doesn't exist any file id with the given filename.");
    return;
  }
  try {
    engine.setModifyingUser(sessionKey, fileId, username);
  } catch (err: any) {
    sendError(user.ws, "ENGINE_ERROR", err.message);
    return;
  }

  try {
    const fileStates = engine.getAllFileStates(sessionKey);
    broadcastSessionState(sessionKey, fileStates);
  } catch (err: any) {
    console.error(
      `[StartWorking] broadcastSessionState failed:`,
      err.message
    );
  }
  console.log( `[StartWorking] ${username} started modifying ${fileId} ` + `in session ${sessionKey}`);
}