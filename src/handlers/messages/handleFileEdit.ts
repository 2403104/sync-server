import { ConnectedUser, getFileIdByPath } from "../../session/sessionManager";
import { broadcastFileEdit, sendError } from "../../broadcast";
import engine from "../../engine";
import { handleStartModifying } from "./handleStartModifying";
import { handleStopModifying } from "./handleStopModifying";
import { markDirty } from "../../timers/dirtyTracker";

const modifyingCooldowns = new Map<string, ReturnType<typeof setTimeout>>();
const MODIFYING_TIMEOUT = 3000; // ms

export async function handleFileEdit(
  user: ConnectedUser, 
  message: { filePath: string; offset: number; length: number; text: string }
): Promise<void> {
  const { sessionKey, username, userId } = user;
  let { filePath, offset, length, text } = message;

  if (
    !filePath ||
    offset === undefined ||
    length === undefined ||
    text === undefined
  ) {
    sendError(user.ws, "MISSING_FIELDS", "FILE_EDIT requires filePath.");
    return;
  }

  filePath = filePath.replace(/\\/g, "/");

  const cooldownKey = `${sessionKey}:${userId}:${filePath}`;
  const isAlreadyModifying = modifyingCooldowns.has(cooldownKey);

  if (!isAlreadyModifying) {
    handleStartModifying(user, { filePath });
  }
  
  if (length === 0 && text === "") return;

  const fileId = getFileIdByPath(sessionKey, filePath);
  
  if (!fileId) {
    sendError(user.ws, "FILE_NOT_FOUND", `File ID not found for path: ${filePath}`);
    return;
  }

  // console.log(`length: ${length} \n filePath: ${filePath}\n offset: ${offset}\n text: ${text}`);
  try {
    if (length === 0) {
      engine.insert(sessionKey, fileId, offset, text);
    } else if (text === "") {
      engine.remove(sessionKey, fileId, offset, length);
    } else {
      engine.remove(sessionKey, fileId, offset, length);
      engine.insert(sessionKey, fileId, offset, text);
    }
  } catch (err: any) {
    sendError(user.ws, "ENGINE_ERROR", err.message);
    return;
  }
  markDirty(sessionKey, fileId);

  broadcastFileEdit(sessionKey, fileId, offset, length, text, userId, username);
  clearTimeout(modifyingCooldowns.get(cooldownKey));
  modifyingCooldowns.set(
    cooldownKey,
    setTimeout(() => {
      modifyingCooldowns.delete(cooldownKey);
      handleStopModifying(user, { filePath: filePath });
    }, MODIFYING_TIMEOUT)
  )
}