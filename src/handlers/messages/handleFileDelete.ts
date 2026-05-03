import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, deleteFileNode } from "../../db/operation";
import { sendError, broadcastFileDeleted } from "../../broadcast";

export async function handleFileDelete(user: ConnectedUser, message: {path: string}) : Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {path} = message;
  if(!path) {
    sendError(user.ws, "MISSING_PATH", "FILE_DELETE requires path");
    return;    
  }
  const node = await getNodeByPath(workspaceId, path);
  if(!node) {
    return;
  }
  if(node.type != "file") {
    sendError(
      user.ws, 
      "INVALID_OPERATION", 
      `Path ${path} is a folder. Use folder deletion instead.`
    );
    return;  
  }
  const nodeId = node._id.toString();
  const success = await deleteFileNode(nodeId);
  if(!success) {
    sendError(
      user.ws,
      "DELETE_FAILED",
      `Failed to delete file: ${path} from database`
    );
    return;
  }
  broadcastFileDeleted(sessionKey, path, user.userId);
  console.log(
    `[FileDelete] ${path} (ID: ${nodeId}) deleted in session ${sessionKey}`
  );  
}