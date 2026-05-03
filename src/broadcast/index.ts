import { WebSocket } from "ws";
// import { publisher } from "../db/redis";
import { getSessionUsers, getFileViewers, ConnectedUser, getFilePath } from "../session/sessionManager";

export type OutgoingMessage =
  | SessionStateMessage
  | FileEditMessage
  | FileSyncMessage
  | FileCreatedMessage
  | FileDeletedMessage
  | FileRenamedMessage
  | FileMovedMessage
  | DirCreatedMessage
  | DirDeletedMessage
  | DirRenamedMessage
  | DirMovedMessage
  | NewSessionCreatedMessage
  | JoinedExistingSession
  | ErrorMessage
  | TotalActiveUsers;


export interface TotalActiveUsers {
  type: "TOTAL_ACTIVE_USERS";
  total: number;
}

export interface NewSessionCreatedMessage {
  type: "NEW_SESSION_CREATED";
  sessionKey: string;
}

export interface JoinedExistingSession {
  type: "JOINED_EXISTING_SESSION";
  sessionKey: string;
}

export interface SessionStateMessage {
  type: "SESSION_STATE";
  files: FileStatusPayload[]
}

export interface FileStatusPayload {
  filePath:    string;       
  viewers:     string[]; 
  isModifying: boolean;
  modifyingBy:  string | null;
}

export interface FileEditMessage {
  type: "FILE_EDIT";
  filePath: string;
  offset: number;
  length: number;
  text: string;
  sentBy: string;
}

export interface FileSyncMessage {
  type: "FILE_SYNC";
  filePath: string;
  content: string;
}

export interface FileCreatedMessage {
  type: "FILE_CREATED",
  path: string,
}

export interface FileDeletedMessage {
  type: "FILE_DELETED",
  path: string
}

export interface FileRenamedMessage {
  type: "FILE_RENAMED",
  oldPath: string, 
  newPath: string
}

export interface FileMovedMessage {
  type: "FILE_MOVED";
  oldPath: string;
  newPath: string;
}

export interface DirCreatedMessage {
  type: "DIR_CREATED";
  path: string;
  nodeId: string;
}

export interface DirDeletedMessage {
  type: "DIR_DELETED";
  path: string;
  deletedPaths: string[];
}

export interface DirRenamedMessage {
  type: "DIR_RENAMED";
  oldPath: string;
  newPath: string;
}

export interface DirMovedMessage {
  type: "DIR_MOVED";
  oldPath: string;
  newPath: string;
}

export interface ErrorMessage {
  type: "ERROR";
  code: string;
  message: string;
}

export function send(ws: WebSocket, message: OutgoingMessage): void {
  if(ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

export function sendToUser(user: ConnectedUser, message: OutgoingMessage): void {
  send(user.ws, message);
}

export function broadcastToSession(sessionKey: string, message: OutgoingMessage, excludeUser?: string): void {
  const users = getSessionUsers(sessionKey);
  users.forEach((user) => {
    if(excludeUser && user.userId === excludeUser) return;
    send(user.ws, message);
  });
}

export function broadcastFileEdit(
  sessionKey: string,
  fileId: string,
  offset: number,
  length: number,
  text:  string,
  senderUserId:  string,
  senderUsername: string
): void {
  let filePath = getFilePath(sessionKey, fileId);
  if(!filePath) return;
  filePath = filePath.replace(/\\/g, "/");
  const message: FileEditMessage = {
    type: "FILE_EDIT",
    filePath: filePath,
    offset,
    length,
    text,
    sentBy: senderUsername,
  };
  broadcastToSession(sessionKey, message, senderUserId);
}

// Complete it optimally (do not send whole file content instead send the diff)
export function sendFileSync(user: ConnectedUser, filePath: string, content: string) : void {
  const message: FileSyncMessage = {
    type: "FILE_SYNC",
    filePath,
    content,
  };
  sendToUser(user, message);
}

export function broadcastSessionState(
  sessionKey: string, 
  fileStates: {
    filePath: string,
    viewers: string[],
    isModifying: boolean,
    modifyingBy: string | null
  }[],
) {
  const files: FileStatusPayload[] = fileStates.map((fs) => {
    const prefix = sessionKey + ":";
    const path = fs.filePath?.startsWith(prefix) 
        ? fs.filePath.slice(prefix.length) 
        : fs.filePath ?? null;
    return {
      filePath: path ?? "",
      viewers: Array.isArray(fs.viewers) ? fs.viewers : [],
      isModifying: fs.isModifying,
      modifyingBy: fs.modifyingBy,
    }
  }).filter((f) => f.filePath.trim() !== "");
  const message: SessionStateMessage = {
    type: "SESSION_STATE",
    files,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastFileCreated(sessionKey: string, path: string): void {
  const message : FileCreatedMessage = {
    type: "FILE_CREATED",
    path
  }
  broadcastToSession(sessionKey, message);
}

export function broadcastFileDeleted(
  sessionKey: string,
  path:       string,
  excludeUserId?: string
): void {
  const message: FileDeletedMessage = {
    type: "FILE_DELETED",
    path,
  };
  broadcastToSession(sessionKey, message, excludeUserId);
}

export function broadcastFileRenamed(
  sessionKey: string,
  oldPath:    string,
  newPath:    string
): void {
  const message: FileRenamedMessage = {
    type: "FILE_RENAMED",
    oldPath,
    newPath,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastFileMoved(
  sessionKey: string,
  oldPath:    string,
  newPath:    string
): void {
  const message: FileMovedMessage = {
    type: "FILE_MOVED",
    oldPath,
    newPath,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastDirCreated(
  sessionKey: string,
  path:       string,
  nodeId:     string
): void {
  const message: DirCreatedMessage = {
    type: "DIR_CREATED",
    path,
    nodeId,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastDirDeleted(
  sessionKey:   string,
  path:         string,
  deletedPaths: string[],
  excludeUserId?: string
): void {
  const message: DirDeletedMessage = {
    type: "DIR_DELETED",
    path,
    deletedPaths,
  };
  broadcastToSession(sessionKey, message, excludeUserId);
}

export function broadcastDirRenamed(
  sessionKey: string,
  oldPath:    string,
  newPath:    string
): void {
  const message: DirRenamedMessage = {
    type: "DIR_RENAMED",
    oldPath,
    newPath,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastTotalActiveUsers(sessionKey: string): void {
  const total = getSessionUsers(sessionKey).length;
  const message: TotalActiveUsers = {
    type: "TOTAL_ACTIVE_USERS",
    total,
  };
  broadcastToSession(sessionKey, message);
}

export function broadcastDirMoved(
  sessionKey: string,
  oldPath:    string,
  newPath:    string
): void {
  const message: DirMovedMessage = {
    type: "DIR_MOVED",
    oldPath,
    newPath,
  };
  broadcastToSession(sessionKey, message);
}

export function sendError(
  ws: WebSocket,
  code: string,
  message: string
): void {
  send(ws, {
    type: "ERROR",
    code,
    message,
  });
}