import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, createDirNode } from "../../db/operation";
import { sendError, broadcastDirCreated } from "../../broadcast";


export async function handleDirCreate(user: ConnectedUser, message: {path: string}): Promise<void> {
  const {sessionKey, workspaceId} = user;
  const {path} = message;
  if(!path) {
    sendError(user.ws, "MISSING_PATH", "DIR_CREATE requires path.");
    return;  
  }
  const existing = await getNodeByPath(workspaceId, path);
  if(existing) {
    sendError(user.ws, "DIR_EXISTS", `Directory already exists: ${path}`);
    return;
  }
  const lstSlash = path.lastIndexOf("/");
  const name = path.slice(lstSlash + 1);
  const parentPath = lstSlash > 0 ? path.slice(0, lstSlash) : "";

  let parentId = workspaceId; // Ultimate root is workspaceId
  if(parentPath) {
    const parentNode = await getNodeByPath(workspaceId, parentPath);
    if(!parentNode) {
      sendError(user.ws, "DIR_NOT_FOUND", `Parent not found: ${parentPath}`);
      return;
    }
    parentId = parentNode._id.toString();
  }
  const node = await createDirNode(workspaceId, parentId, name, path);
  if(!node) {
    sendError(user.ws, "CREATE_FAILED", `Failed to create directory: ${path}`);
    return;
  }
  broadcastDirCreated(sessionKey, path, node._id.toString());
  console.log(`[DirCreate] ${path} created in session ${sessionKey}`);
}