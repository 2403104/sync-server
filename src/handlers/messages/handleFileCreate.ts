import { ConnectedUser } from "../../session/sessionManager";
import { getNodeByPath, createFileNode, getNodeById, ensureDirExist } from "../../db/operation";
import { sendError, broadcastFileCreated } from "../../broadcast";

export async function handleFileCreate(user: ConnectedUser, message: {path: string}) : Promise<void> {
  const {sessionKey, workspaceId, username} = user;
  const {path} = message;
  console.log(`[Path Debug] Path to be created: ${path}`);
  if(!path) {
    sendError(user.ws, "MISSING_PATH", "FILE_CREATE requires path.");
    return;  
  }
  const existing = await getNodeByPath(workspaceId, path);
  if(existing) {
    if(existing.type === "file") {
      return;
    }
    sendError(user.ws, "FILE_EXISTS", `Path already exists: ${path}`);
    return;
  }
  const lstSlash = path.lastIndexOf("/");
  const name = path.slice(lstSlash + 1);
  const parentPath = lstSlash > 0 ? path.slice(0, lstSlash) : "";

  const parentId = await ensureDirExist(workspaceId, parentPath);
  if(!parentId) {
    sendError(user.ws, "CREATE_FAILED", `Failed to resolve or create parent path: ${parentPath}`);
    return;
  }
  // Node content id is the _id of its content
  let node = await createFileNode(workspaceId, parentId, name, path);
  if(!node) {
    const again = await getNodeByPath(workspaceId, path);
    if(again && again.type === "file") {
      node = again;
    } else {
      sendError(user.ws, "CREATE_FAILED", `Failed to create file: ${path}`);
      return;
    }
  }

  broadcastFileCreated(sessionKey, path);
  console.log(`[FileCreate] ${path} created in session ${sessionKey}`);
}