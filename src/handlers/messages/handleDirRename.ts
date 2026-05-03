import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, createDirNode, renameDirNode } from "../../db/operation";
import { sendError, broadcastDirRenamed } from "../../broadcast";

export async function handleDirRename(user: ConnectedUser, message: {oldPath: string, newPath: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {oldPath, newPath} = message;
  if(!oldPath || !newPath) {
    sendError(user.ws, "MISSING PATHS", "DIR_RENAME requires both oldPath and newPath");
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
  const newPathName = newPath.slice(lstSlash + 1);
  const nodeId = oldNode._id.toString();
  const success = await renameDirNode(workspaceId, nodeId, newPathName, oldPath, newPath);
  if(!success) {
    sendError(user.ws, "RENAME_FAILED", `Failed to rename directory from ${oldPath} to ${newPath} in database`);
    return;
  }
  broadcastDirRenamed(sessionKey, oldPath, newPath);
  console.log(`[DirRename] ${oldPath} -> ${newPath}`);
}