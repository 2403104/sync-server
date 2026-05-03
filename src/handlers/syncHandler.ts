import { WebSocket } from "ws";
import { getWorkspaceBySessionKey, getFileTree, loadFileContent, loadFileHash } from "../db/operation";
import FSNode from "../models/FSNode";
import engine from "../engine";

const TARGET_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

export async function handleWsSyncRequest(ws: WebSocket, message: any): Promise<void> {
  const {sessionKey, clientManifest = {}} = message;
  try {
    const workspace = await getWorkspaceBySessionKey(sessionKey);
    if(!workspace) {
      ws.send(JSON.stringify({ type: "SYNC_ERROR", message: "Session not found." }));
      return;
    }      
    const workspaceId = workspace._id.toString();
    const currentNodes = await FSNode.find({ workspaceId }).lean();
    
    const toUpdate : any[] = [];
    const dbPaths = new Set<string> ();
    for(const node of currentNodes) {
      dbPaths.add(node.path);
      const clientEntry = clientManifest[node.path];
      if(node.type == "file") {
        const fileContent = await loadFileContent(node.contentId.toString());
        const serverHash = await loadFileHash(node.contentId.toString());
        if(!clientEntry || (clientEntry.hash !== serverHash)) {
          toUpdate.push({
            type: "file", 
            path: node.path,
            content: fileContent          
          }) 
        }
      } else if(node.type === "folder") {
        if(!clientEntry)  {
          toUpdate.push({type : "folder", path: node.path});
        }
      }
    }

    const toDelete = Object.keys(clientManifest).filter(p => !dbPaths.has(p));

    ws.send(JSON.stringify({
      type: "SYNC_START",
      totalFiles: toUpdate.length + toDelete.length,
    }));

    ws.send(JSON.stringify({
      type : "SYNC_DELETE",
      totalFilesToDelete : toDelete.length,
      toDelete
    }));

    let currentBatch: any[] = [];
    let currentBatchBytes = 0;

    for(const meta of toUpdate) {
      let content = "";
      if(meta.type === "file") {
        content = meta.content;
      }
      const contentSize = Buffer.byteLength(content, "utf8");
      currentBatch.push({
        type : meta.type, 
        path: meta.path,
        content      
      });
      currentBatchBytes +=  contentSize;
      if(currentBatchBytes >= TARGET_CHUNK_SIZE) {
        ws.send(JSON.stringify({
          type: "SYNC_CHUNK", 
          files : currentBatch
        }));
        currentBatch = [];
        currentBatchBytes = 0;      
      }
    }

    if(currentBatch.length > 0) {
      ws.send(JSON.stringify({ type: "SYNC_CHUNK", files: currentBatch }));
    }
    ws.send(JSON.stringify({type  : "SYNC_COMPLETE"}));

  } catch (err: any) {
    console.error("[Sync] Error: ", err.message);
    ws.send(JSON.stringify({ type: "SYNC_ERROR", message: "Internal server error." }));
  }
}
