import path from "path";
import config from "../config";

const enginePath = path.resolve(__dirname, config.engine.path);

const _engine = require(enginePath);

/** C++ engine throws if session/file was never opened or already torn down — safe to ignore for cleanup paths. */
function isBenignMissingState(msg: string): boolean {
  return /not found|session not found/i.test(String(msg ?? ""));
}

interface PieceSnapshot {
  bufferType: 0 | 1,
  start: number,
  length: number
}

interface FileStatus {
  filePath: string,
  viewers: string[],
  isModifying: boolean,
  modifyingBy: string
}

const engine = {

  openFile(
    sessionKey: string,
    fileId: string,
    filePath: string,
    content: string
  ): void {
    try {
      _engine.openFile(sessionKey, fileId, filePath, content);
    } catch (err: any) {
      console.error(`[Engine] openFile failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  closeFile(sessionKey: string, fileId: string): void {
    try {
      _engine.closeFile(sessionKey, fileId);
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return;
      console.error(`[Engine] closeFile failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  closeSession(sessionKey: string): void {
    try {
      _engine.closeSession(sessionKey);
    } catch (err: any) {
      console.error(`[Engine] closeSession failed [${sessionKey}]:`, err.message);
      throw err;
    }
  },


  insert(
    sessionKey: string,
    fileId: string,
    offset: number,
    text: string
  ): void {
    try {
      _engine.insert(sessionKey, fileId, offset, text);
    } catch (err: any) {
      console.error(`[Engine] insert failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  remove(
    sessionKey: string,
    fileId: string,
    offset: number,
    length: number
  ): void {
    try {
      _engine.remove(sessionKey, fileId, offset, length);
    } catch (err: any) {
      console.error(`[Engine] remove failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },


  setModifyingUser(
    sessionKey: string,
    fileId: string,
    username: string
  ): void {
    try {
      _engine.setModifyingUser(sessionKey, fileId, username);
    } catch (err: any) {
      console.error(`[Engine] setModifyingUser failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  getModifyingUser(sessionKey: string, fileId: string): string {
    try {
      return _engine.getModifyingUser(sessionKey, fileId) as string;
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return "";
      console.error(`[Engine] getModifyingUser failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  clearModifyingUser(sessionKey: string, fileId: string): void {
    try {
      _engine.clearModifyingUser(sessionKey, fileId);
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return;
      console.error(`[Engine] clearModifyingUser failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  setViewer(
    sessionKey: string,
    fileId: string,
    username: string
  ): void {
    try {
      _engine.setViewer(sessionKey, fileId, username);
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return;
      console.error(`[Engine] setViewer failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  clearViewer(
    sessionKey: string,
    fileId: string,
    username: string
  ): void {
    try {
      _engine.clearViewer(sessionKey, fileId, username);
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return;
      console.error(`[Engine] clearViewer failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  getBuffer(sessionKey: string, fileId: string): string {
    try {
      return _engine.getBuffer(sessionKey, fileId) as string;
    } catch (err: any) {
      console.error(`[Engine] getBuffer failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },

  getPieces(sessionKey: string, fileId: string): PieceSnapshot[] {
    try {
      return _engine.getPieces(sessionKey, fileId) as PieceSnapshot[];
    } catch (err: any) {
      console.error(`[Engine] getPieces failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },


  getAllFileStates(sessionKey: string): FileStatus[] {
    try {
      return _engine.getAllFileStates(sessionKey) as FileStatus[];
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return [];
      console.error(`[Engine] getAllFileStates failed [${sessionKey}]:`, err.message);
      throw err;
    }
  },

  isFileOpen(sessionKey: string, fileId: string): boolean {
    try {
      return _engine.isFileOpen(sessionKey, fileId) as boolean;
    } catch (err: any) {
      if (isBenignMissingState(err.message)) return false;
      console.log(`[Engine] isFileOpen failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },


  restoreFile(
    sessionKey: string,
    fileId: string,
    filePath: string,
    original: string,
    add: string,
    pieces: PieceSnapshot[]
  ): void {
    try {
      _engine.restoreFile(sessionKey, fileId, filePath, original, add, pieces);
    } catch (err: any) {
      console.error(`[Engine] restoreFile failed [${sessionKey}:${fileId}]:`, err.message);
      throw err;
    }
  },
};

export default engine;
export type {PieceSnapshot, FileStatus};