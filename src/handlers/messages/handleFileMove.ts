import { ConnectedUser } from "../../session/sessionManager";
import { ensureDirExist, getNodeByPath, moveFileNode, renameFileNode } from "../../db/operation";
import { sendError, broadcastFileMoved } from "../../broadcast";

export async function handleFileMove(user: ConnectedUser, message: {oldPath: string, newPath: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {oldPath, newPath} = message;
  if(!oldPath || !newPath) {
    sendError(user.ws, "MISSING_PATHS", "FILE_MOVE requires both oldPath and newPath");
    return;
  }
  if(oldPath == newPath)  return;
  const existingDest = await getNodeByPath(workspaceId, newPath);
  if(existingDest) {
    sendError(user.ws, "New File exists already.", `Cannot rename: A file or folder already exists at ${newPath}`);
    return;
  }
  const oldNode = await getNodeByPath(workspaceId, oldPath);
  if(!oldNode)  {
    sendError(user.ws, "Old File Not found.", `Cannot rename: File ${oldPath} does not exist`);
    return;
  }
  if(oldNode.type != "file") {
    sendError(user.ws, "INVALID_OPERATION", `Path ${oldPath} is a folder. Use folder rename instead.`);
    return;
  }
  const lstSlash = newPath.lastIndexOf("/");
  const newParentPath = lstSlash > 0 ? newPath.substring(0, lstSlash) : "";
  let newParentId = await ensureDirExist(workspaceId, newParentPath);
  if(!newParentId) {
    sendError(user.ws, "MOVE_FILE_FAILED", `Failed to resolve or create destination path: ${newParentPath}`);
    return;
  }
  const nodeId = oldNode._id.toString();
  const success = await moveFileNode(nodeId, newParentId, newPath);
  if(!success) {
    sendError(user.ws, "MOVE_FILE_FAILED", `Failed to move file from ${oldPath} to ${newPath} in database`);
    return;
  }
  broadcastFileMoved(sessionKey, oldPath, newPath);
  console.log(`[FileMove] ${oldPath} -> ${newPath} (ID: ${nodeId}) in session ${sessionKey}`);
}