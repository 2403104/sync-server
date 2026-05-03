import { ConnectedUser } from "../session/sessionManager";
import { sendError } from "../broadcast";

import { handleFileCreate } from "./messages/handleFileCreate";
import { handleFileDelete } from "./messages/handleFileDelete";
import { handleFileEdit } from "./messages/handleFileEdit";
import { handleFileMove } from "./messages/handleFileMove";
import { handleFileRename } from "./messages/handleFileRename";
import { handleOpenFile } from "./messages/handleOpenFile";
import { handleCloseFile } from "./messages/handleCloseFile";

import { handleDirCreate } from "./messages/handleDirCreate";
import { handleDirDelete } from "./messages/handleDirDelete";
import { handleDirMove } from "./messages/handleDirMove";
import { handleDirRename } from "./messages/handleDirRename";

import { handleStartModifying } from "./messages/handleStartModifying";
import { handleStopModifying } from "./messages/handleStopModifying";

import engine from "../engine";

export async function onLiveMessage(user: ConnectedUser, rawData: any) :  Promise<void> {
  let message;
  try {
    const dataStr = rawData instanceof Buffer ? rawData.toString() : rawData;
    const jsonStr = typeof dataStr === "string" ? dataStr: JSON.stringify(dataStr);
    message = JSON.parse(jsonStr);
  } catch (err: any) {
    console.error(`[onLiveMessage] Failed to parse JSON from user ${user.sessionKey}`);
    sendError(user.ws, "INVALID_JSON", "Message payload must be valid JSON");
    return;
  }
  if(!message || !message.type) {
    sendError(user.ws, "MISSING_TYPE", "Message must include a 'type' field");
    return;
  }
  try {
    const fileStates = engine.getAllFileStates(user.sessionKey);
    switch(message.type){
      // File Operations
      case "FILE_CREATE":
        await handleFileCreate(user, message);
        break;
      case "FILE_DELETE":
        await handleFileDelete(user, message);
        break;
      case "FILE_MOVE":
        await handleFileMove(user, message);
        break;
      case "FILE_RENAME":
        await handleFileRename(user, message);
        break;

      // Directory Operations
      case "DIR_CREATE":
        await handleDirCreate(user, message);
        break;
      case "DIR_DELETE":
        await handleDirDelete(user, message);
        break;
      case "DIR_MOVE":
        await handleDirMove(user, message);
        break;
      case "DIR_RENAME":
        await handleDirRename(user, message);
        break;

      // Collaborative or Editing Operatins
      case "FILE_OPEN":
        await handleOpenFile(user, message);
        break;
      case "FILE_CLOSE":
        await handleCloseFile(user, message);
        break;
      case "FILE_EDIT": // (Handling both just in case frontend sends TEXT_EDIT)
        await handleFileEdit(user, message);
        break;

      // Unknown Operations
      default:
        console.warn(`[onLiveMessage] Unknown message type received: ${message.type}`);
        sendError(
          user.ws,
          "UNKNOWN_TYPE",
          `Server does not recognize message type: ${message.type}`
        );
        break;
    }
    
  } catch (err: any) {
    console.error(`[onLiveMessage] Unhandled error processing ${message.type}:`, err);
    sendError(
      user.ws,
      "SERVER_ERROR",
      `An internal server error occurred while processing ${message.type}`
    );
    return;
  }
}