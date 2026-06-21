/** Local store for WHEUAT.TV uploads.
 *  - Blobs live in IndexedDB (object store "blobs")
 *  - Metadata, likes, comments live in localStorage for easy reactivity
 *  Per-device only (no server). When the user signs up cloud sync, swap this
 *  out for a Supabase-backed implementation.
 */

const DB_NAME = "wheuat-tv";
const STORE = "blobs";
const META_KEY = "wheuat-tv-meta-v1";

export type WheuatTvKind = "podcast" | "short-film" | "music-video";

export interface WheuatTvItem {
  id: string;
  kind: WheuatTvKind;
  title: string;
  description?: string;
  uploaderId: string;
  uploaderName: string;
  mime: string;
  ext: string;
  durationMs?: number;
  createdAt: number;
  thumbDataUrl?: string;
  likes: string[]; // user ids
  comments: WheuatTvComment[];
}

export interface WheuatTvComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(id: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(id);
    r.onsuccess = () => resolve((r.result as Blob) || null);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return blob;
}

async function deleteBlob(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function readMeta(): WheuatTvItem[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeMeta(items: WheuatTvItem[]) {
  localStorage.setItem(META_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("wheuat-tv-updated"));
}

export const WheuatTv = {
  list(): WheuatTvItem[] {
    return readMeta().sort((a, b) => b.createdAt - a.createdAt);
  },
  async add(
    input: {
      id?: string;
      kind: WheuatTvKind;
      title: string;
      description?: string;
      uploaderId: string;
      uploaderName: string;
      blob: Blob;
      mime?: string;
      ext?: string;
      durationMs?: number;
      thumbDataUrl?: string;
    },
  ): Promise<WheuatTvItem> {
    const id = input.id ?? `tv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await putBlob(id, input.blob);
    const item: WheuatTvItem = {
      id,
      kind: input.kind,
      title: input.title,
      description: input.description,
      uploaderId: input.uploaderId,
      uploaderName: input.uploaderName,
      mime: input.mime || input.blob.type || "video/mp4",
      ext: input.ext || "mp4",
      durationMs: input.durationMs,
      createdAt: Date.now(),
      thumbDataUrl: input.thumbDataUrl,
      likes: [],
      comments: [],
    };
    const meta = readMeta();
    meta.push(item);
    writeMeta(meta);
    return item;
  },
  async remove(id: string) {
    await deleteBlob(id).catch(() => {});
    writeMeta(readMeta().filter((i) => i.id !== id));
  },
  async getUrl(id: string): Promise<string | null> {
    const blob = await getBlob(id);
    return blob ? URL.createObjectURL(blob) : null;
  },
  toggleLike(id: string, userId: string) {
    const meta = readMeta();
    const it = meta.find((m) => m.id === id);
    if (!it) return;
    it.likes = it.likes.includes(userId) ? it.likes.filter((u) => u !== userId) : [...it.likes, userId];
    writeMeta(meta);
  },
  addComment(id: string, c: Omit<WheuatTvComment, "id" | "createdAt">) {
    const meta = readMeta();
    const it = meta.find((m) => m.id === id);
    if (!it) return;
    it.comments.push({ ...c, id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() });
    writeMeta(meta);
  },
  rename(id: string, title: string) {
    const meta = readMeta();
    const it = meta.find((m) => m.id === id);
    if (!it) return;
    it.title = title;
    writeMeta(meta);
  },
};
