import { saveFileContent } from "../db/operation";
import engine from "../engine";

interface DirtyEntry {
  sessionKey: string,
  fileId: string, 
  isDirty: boolean,
  timer: NodeJS.Timeout | null
};

const DEBOUNCE_TIME = 3000; //3 MS after last edit

const dirtyMap = new Map<string, DirtyEntry>();

function makeKey(sessionKey: string, fileId: string) : string {
  return `${sessionKey}-${fileId}`;
}

// Called when a file is first opened in c++ engine
export function registerFileInDirtyTracker(sessionKey: string, fileId: string)  : void {
  const key = makeKey(sessionKey, fileId);
  if(dirtyMap.has(key)) return;
  dirtyMap.set(key, {
    sessionKey,
    fileId,
    isDirty: false,
    timer: null  
  })
  console.log(`[DirtyTracker] Registered file [${key}]`);  
}

// Called when file is closed and no viewers remain
export async function unregisterFileInDirtyTracker(sessionKey: string, fileId: string) : Promise<void> {
  const key = makeKey(sessionKey, fileId);
  const entry = dirtyMap.get(key);
  if(!entry) return;
  await flushIfDirty(sessionKey, fileId);
  dirtyMap.delete(key);
  console.log(`[DirtyTracker] Unregistered file [${key}]`);
}

// Called after every TEXT_EDIT.
export function markDirty (sessionKey: string, fileId: string) : void {
  const key = makeKey(sessionKey, fileId);
  const entry = dirtyMap.get(key);
  if(!entry) return;
  entry.isDirty = true;
  if(entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;  
  }
  entry.timer = setTimeout(async () =>{
    await _flushToDB(sessionKey, fileId);
  }, DEBOUNCE_TIME);
}

// called when file is closed or session ends
export async function flushIfDirty(sessionKey: string, fileId: string) : Promise<void> {
  const key = makeKey(sessionKey, fileId);
  const entry = dirtyMap.get(key);
  if(!entry) return;
  if(entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;  
  }
  if(!entry.isDirty) return;
  dirtyMap.delete(key);
  await _flushToDB(sessionKey, fileId);
  console.log(`[DirtyTracker] Flushed file [${key}]`);
}

export async function flushAllInSession(sessionKey: string) : Promise<void> {
  const promises : Promise<void>[] =  [];
  dirtyMap.forEach((entry, key) => {

  });
}

export async function unregisterSession(sessionKey: string) :  Promise<void> {

}

async function _flushToDB(sessionKey: string, fileId: string) : Promise<void> {
  const key = makeKey(sessionKey, fileId);
  const entry = dirtyMap.get(key);
  if(!entry) return;
  try {
    const content = engine.getBuffer(entry.sessionKey, entry.fileId);
    await saveFileContent(entry.fileId, content);

    entry.isDirty = false;
    entry.timer = null;
    // dirtyMap.delete(key);

    console.log(`[DirtyTracker] Flushed file [${key}]`);
  } catch (err: any) {
    console.error(`[DirtyTracker] Failed to flush file [${key}]:`, err.message);
  }  
}

export function isDirty(
  sessionKey: string,
  fileId:     string
): boolean {
  return dirtyMap.get(makeKey(sessionKey, fileId))?.isDirty ?? false;
}