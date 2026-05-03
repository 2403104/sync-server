import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, renameFileNode } from "../../db/operation";
import { sendError, broadcastFileRenamed } from "../../broadcast";

export async function handleFileRename(user: ConnectedUser, message: {oldPath: string, newPath: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {oldPath, newPath} = message;
  if(!oldPath || !newPath) {
    sendError(user.ws, "MISSING PATHS", "FILE_RENAME requires both oldPath and newPath");
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
  if(oldNode.type != "file") {
    sendError(user.ws, "INVALID_OPERATION", `Path ${oldPath} is a folder. Use folder rename instead.`);
    return;
  }
  const nodeId = oldNode._id.toString();
  const lstSlash = newPath.lastIndexOf("/");
  const newName = newPath.slice(lstSlash + 1);
  const success = await renameFileNode(nodeId, newName, newPath);
  if(!success) {
    sendError(user.ws, "RENAME_FAILED", `Failed to rename file from ${oldPath} to ${newPath} in database`);
    return;
  }
  broadcastFileRenamed(sessionKey, oldPath, newPath);
  console.log(`[FileRename] ${oldPath} -> ${newPath}`);
}