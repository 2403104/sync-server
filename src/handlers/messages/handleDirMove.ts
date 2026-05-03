import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, moveDirNode } from "../../db/operation";
import { sendError, broadcastDirMoved } from "../../broadcast";

export async function handleDirMove(user: ConnectedUser, message: {oldPath: string, newPath: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {oldPath, newPath} = message;
  if(!oldPath || !newPath) {
    sendError(user.ws, "MISSING PATHS", "DIR_MOVE requires both oldPath and newPath");
    return;
  }
  if(oldPath == newPath) return;
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
  if(oldNode.type != "folder") {
    sendError(user.ws, "INVALID_OPERATION", `Path ${oldPath} is a file. Use file rename instead.`);
    return;
  }
  const lstSlash = newPath.lastIndexOf("/");
  const newParentPath = lstSlash > 0 ? newPath.substring(0, lstSlash) : "";
  let newParentId = workspaceId;
  if(newParentPath) {
    const parentNode = await getNodeByPath(workspaceId, newParentPath);
    if(!parentNode) {
      sendError(user.ws, "PARENT_NOT_FOUND", `Cannot move: Destination directory ${newParentPath} not found`);
      return;
    } 
    newParentId = parentNode._id.toString();
  }
  const nodeId = oldNode._id.toString();
  const success = await moveDirNode(workspaceId, nodeId, newParentId, oldPath, newPath);
  if(!success) {
    sendError(user.ws, "MOVE_DIR_FAILED", `Failed to move directory from ${oldPath} to ${newPath} in database`);
    return;
  }
  broadcastDirMoved(sessionKey, oldPath, newPath);
  console.log(`[DirMove] ${oldPath} -> ${newPath}`);
}