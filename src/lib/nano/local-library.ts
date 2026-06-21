const DB_NAME = "poprink-local-db";
const STORE_NAME = "handles";
const KEY = "dir-handle";

export interface LocalSubtitle {
  file: string;
  label: string;
  language: string;
}

export interface LocalMediaItem {
  id: string;
  type: "movie" | "tv";
  title: string;
  poster?: string;
  file?: string; // For movie
  seasons?: Record<string, Record<string, string>>; // season_number -> episode_number -> file_path
  subtitles?: LocalSubtitle[];
}

export function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

export function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, KEY);
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

export function clearStoredHandle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(KEY);
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

export async function verifyPermission(handle: FileSystemHandle, readWrite = false): Promise<boolean> {
  if (typeof handle.queryPermission !== "function") return true;
  const options: FileSystemHandlePermissionDescriptor = {
    mode: readWrite ? "readwrite" : "read",
  };
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}

export async function loadRinkJson(dirHandle: FileSystemDirectoryHandle): Promise<LocalMediaItem[]> {
  try {
    const fileHandle = await dirHandle.getFileHandle("rink.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export function srtToVtt(srtText: string): string {
  let vtt = srtText.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
  return "WEBVTT\n\n" + vtt;
}

export async function getLocalFileHandle(dirHandle: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemFileHandle> {
  const parts = relativePath.split(/[/\\]/).filter(Boolean);
  let currentDir = dirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i]);
  }
  return await currentDir.getFileHandle(parts[parts.length - 1]);
}

export async function getLocalFileUrl(dirHandle: FileSystemDirectoryHandle, relativePath: string): Promise<string> {
  const fileHandle = await getLocalFileHandle(dirHandle, relativePath);
  const file = await fileHandle.getFile();
  
  if (file.name.endsWith(".srt")) {
    const text = await file.text();
    const vttText = srtToVtt(text);
    const blob = new Blob([vttText], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  }
  
  return URL.createObjectURL(file);
}
