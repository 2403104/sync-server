import { WebSocket } from "ws";

export interface ConnectedUser {
  ws: WebSocket;
  userId: string;
  username: string;
  machineId: string;
  sessionKey: string;
  workspaceId: string;
}

interface FileEntry {
  filePath: string;
  viewers:  Set<string>; // Set<userId>
}

interface SessionEntry {
  users: Map<string, ConnectedUser>;   // userId -> connectedUser
  currentFile: Map<string, string>;    // userId -> fileId
  fileViewers: Map<string, FileEntry>; // fileId -> FileEntry
  pathToId: Map<string, string>;       // filePath -> fileId (THE NEW MAP)
}

const sessions = new Map<string, SessionEntry>(); // sessionKey -> Entry

const wsIndex = new Map<WebSocket, {sessionKey: string, userId: string}>(); // reverse look up

function getOrCreateSession(sessionKey: string) : SessionEntry {
  if(!sessions.has(sessionKey)) {
    sessions.set(sessionKey, {
      users: new Map(),
      currentFile: new Map(),
      fileViewers: new Map(),
      pathToId: new Map(), // Initialize the new map
    });
  }
  return sessions.get(sessionKey)!;
}

export function joinUserNameAndMachineId(username: string, machineId: string) : string {
  return `${username}(@${machineId})`;
}

export function joinPathSessionKey(path: string, sessionKey: string) : string {
  return `${sessionKey}:${path}`;
}

export function getUserFromWs(ws: WebSocket): ConnectedUser | null {
  const index = wsIndex.get(ws);
  if(!index) return null;

  const {sessionKey, userId} = index;
  return sessions.get(sessionKey)?.users.get(userId) ?? null;
}

export function addUser(user: ConnectedUser): void {
  const session = getOrCreateSession(user.sessionKey);
  session.users.set(user.userId, user);
  wsIndex.set(user.ws, {sessionKey: user.sessionKey, userId: user.userId});
}

function _removeFromFile(session: SessionEntry, userId: string, fileId: string) {
  const entry = session.fileViewers.get(fileId);
  if(!entry) return;
  
  entry.viewers.delete(userId);
  
  if(entry.viewers.size == 0) {
    session.pathToId.delete(entry.filePath); // Clean up the new map
    session.fileViewers.delete(fileId);
  }
}

export function removeUser(ws: WebSocket): ConnectedUser | null { 
  const index = wsIndex.get(ws);
  if(!index) return null;

  const {sessionKey, userId} = index;
  wsIndex.delete(ws);

  const session = sessions.get(sessionKey);
  if(!session) return null;

  const user = session.users.get(userId) ?? null;
  if(!user) return null;

  const currentFile = session.currentFile.get(userId);
  if(currentFile) {
    _removeFromFile(session, userId, currentFile);
    session.currentFile.delete(userId);
  }

  session.users.delete(userId);

  if(session.users.size === 0) {
    sessions.delete(sessionKey);
  }
  return user;
}

export function userEntersFile(
  sessionKey: string,
  userId: string,
  fileId: string,
  filePath: string
): void {
  const session = sessions.get(sessionKey);
  if(!session) return;
  
  const prevFileId = session.currentFile.get(userId);
  if(prevFileId && prevFileId !== fileId) {
    _removeFromFile(session, userId, prevFileId);
  }

  if(!session.fileViewers.has(fileId)) {
    session.fileViewers.set(fileId, { filePath, viewers: new Set() });
    session.pathToId.set(filePath, fileId); // Populate the new map
  }

  session.fileViewers.get(fileId)!.viewers.add(userId);
  session.currentFile.set(userId, fileId);
}

export function userLeavesFile(sessionKey:string, userId: string, fileId: string) {
  const session = sessions.get(sessionKey);
  if(!session) return;

  _removeFromFile(session, userId, fileId);
  session.currentFile.delete(userId);
}

export function getUser(ws : WebSocket) : ConnectedUser | null {
  const index = wsIndex.get(ws);
  if(!index) return null;

  return (sessions.get(index.sessionKey)?.users.get(index.userId) ?? null);
}

export function getUserById(sessionKey: string, userId: string): ConnectedUser | null {
  return sessions.get(sessionKey)?.users.get(userId) ?? null;
}

export function getSessionUsers(sessionKey: string): ConnectedUser[] {
  const session = sessions.get(sessionKey);
  if (!session) return [];
  return Array.from(session.users.values());
}

export function getFileViewers(sessionKey: string, fileId: string) : ConnectedUser[] {
  const session = sessions.get(sessionKey);
  if (!session) return [];

  const entry = session.fileViewers.get(fileId);
  if (!entry) return [];

  const result: ConnectedUser[] = [];
  
  entry.viewers.forEach((uid) => {
    const user = session.users.get(uid);
    if (user) {
      result.push(user);
    }
  });
  return result;
}

export function getFilePath(
  sessionKey: string,
  fileId: string
): string | null {
  const raw = sessions.get(sessionKey)?.fileViewers.get(fileId)?.filePath ?? null;
  const prefix = sessionKey + ":";
  const path = raw?.startsWith(prefix) 
      ? raw.slice(prefix.length) 
      : raw ?? null;
  return path;
}

export function getUserCurrentFile(sessionKey: string, userId: string) : string | null {
  return sessions.get(sessionKey)?.currentFile.get(userId) ?? null;
}

export function isSessionEmpty(sessionKey: string): boolean {
  const session = sessions.get(sessionKey);
  if (!session) return true;
  return session.users.size === 0;
}

export function getSessionCount(): number {
  return sessions.size;
}

export function getUserCount(sessionKey: string): number {
  return sessions.get(sessionKey)?.users.size ?? 0;
}

// THIS IS NOW INSTANT O(1) LOOKUP
// Clients send workspace-relative paths (e.g. "src/a.cpp"); pathToId is keyed by joinPathSessionKey(...)
// from userEntersFile — resolve both forms.
export function getFileIdByPath(sessionKey: string, filePath: string): string | null {
  const session = sessions.get(sessionKey);
  if (!session) return null;

  return (
    session.pathToId.get(filePath) ??
    session.pathToId.get(joinPathSessionKey(filePath, sessionKey)) ??
    null
  );
}

export function getUserCurrentFileBeforeRemoval(ws: WebSocket): { sessionKey: string; userId: string; fileId: string | null } | null {
  const index = wsIndex.get(ws);
  if(!index) return null;
  const {sessionKey, userId} = index;
  const fileId = sessions.get(sessionKey)?.currentFile.get(userId) ?? null;
  return {sessionKey, userId, fileId};
}