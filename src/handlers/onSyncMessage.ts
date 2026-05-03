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

export async function onSyncMessage(user: ConnectedUser, rawData: any) : Promise<void> {
  
}