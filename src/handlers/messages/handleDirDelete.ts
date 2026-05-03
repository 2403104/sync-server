import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, deleteDirRecursive } from "../../db/operation";
import { sendError, broadcastDirDeleted } from "../../broadcast";

export async function handleDirDelete(user: ConnectedUser, message: {path: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {path} = message;
  if(!path) {
    sendError(user.ws, "MISSING_PATH", "DIR_DELETE requires path");
    return;    
  }
  const node = await getNodeByPath(workspaceId, path);
  if(!node) {
    return;
  }
  if(node.type != "folder") {
    sendError(user.ws, "INVALID_OPERATION", `Path ${path} is a file. Use file deletion instead.`);
    return;  
  } 
  const nodeId = node._id.toString();
  const deletedPaths = await deleteDirRecursive(workspaceId, nodeId);
  if(!deletedPaths || deletedPaths.length === 0) {
    sendError(user.ws, "DELETE_FAILED", `Failed to delete directory: ${path} from database`);
    return;
  }
  broadcastDirDeleted(sessionKey, path, deletedPaths, user.userId);
  console.log(`[DirDelete] ${path} (and ${deletedPaths.length - 1} children) deleted in session ${sessionKey}`);
}