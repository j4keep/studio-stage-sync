// IndexedDB-backed chunk store for crash-safe local podcast recording.
// Schema:
//   sessions:  { id, sessionId, participantName, mime, ext, startedAt, lastUpdated, finalized }
//   chunks:    { id (autoIncrement), sessionDbId, index, blob }
//
// Usage:
//   const rec = await PodcastRecovery.create({ sessionId, participantName, mime });
//   await rec.appendChunk(blob);
//   await rec.finalize();   // marks complete (so it won't show in recovery list)
//   const list = await PodcastRecovery.listUnfinished();
//   const blob = await PodcastRecovery.assembleBlob(dbId);
//   await PodcastRecovery.discard(dbId);

const DB_NAME = "wstudio-podcast-recovery";
const DB_VERSION = 2;
const STORE_SESSIONS = "sessions";
const STORE_CHUNKS = "chunks";
const STORE_FINALS = "finals";

export type RecoverySessionRow = {
  id: number;
  sessionId: string;
  participantName: string;
  mime: string;
  ext: string;
  startedAt: number;
  lastUpdated: number;
  finalized: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const s = db.createObjectStore(STORE_CHUNKS, { keyPath: "id", autoIncrement: true });
        s.createIndex("by_session", "sessionDbId");
      }
      if (!db.objectStoreNames.contains(STORE_FINALS)) {
        db.createObjectStore(STORE_FINALS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    Promise.resolve(fn(t)).then((r) => { result = r as T; }).catch(reject);
  });
}

async function listUnfinished(): Promise<RecoverySessionRow[]> {
  const db = await openDb();
  return tx(db, [STORE_SESSIONS], "readonly", (t) => new Promise<RecoverySessionRow[]>((res) => {
    const req = t.objectStore(STORE_SESSIONS).getAll();
    req.onsuccess = () => res((req.result as RecoverySessionRow[]).filter((r) => !r.finalized));
  }));
}

async function listAll(): Promise<RecoverySessionRow[]> {
  const db = await openDb();
  return tx(db, [STORE_SESSIONS], "readonly", (t) => new Promise<RecoverySessionRow[]>((res) => {
    const req = t.objectStore(STORE_SESSIONS).getAll();
    req.onsuccess = () => res(req.result as RecoverySessionRow[]);
  }));
}

async function assembleBlob(dbId: number): Promise<{ blob: Blob; meta: RecoverySessionRow } | null> {
  const db = await openDb();
  return tx(db, [STORE_SESSIONS, STORE_CHUNKS], "readonly", (t) => new Promise((res) => {
    const sReq = t.objectStore(STORE_SESSIONS).get(dbId);
    sReq.onsuccess = () => {
      const meta = sReq.result as RecoverySessionRow | undefined;
      if (!meta) return res(null);
      const idx = t.objectStore(STORE_CHUNKS).index("by_session");
      const cReq = idx.getAll(IDBKeyRange.only(dbId));
      cReq.onsuccess = () => {
        const rows = (cReq.result as Array<{ index: number; blob: Blob }>).sort((a, b) => a.index - b.index);
        const blob = new Blob(rows.map((r) => r.blob), { type: meta.mime });
        res({ blob, meta });
      };
    };
  }));
}

async function discard(dbId: number): Promise<void> {
  const db = await openDb();
  await tx(db, [STORE_SESSIONS, STORE_CHUNKS], "readwrite", (t) => new Promise<void>((res) => {
    t.objectStore(STORE_SESSIONS).delete(dbId);
    const idx = t.objectStore(STORE_CHUNKS).index("by_session");
    const cur = idx.openCursor(IDBKeyRange.only(dbId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { c.delete(); c.continue(); } else { res(); }
    };
  }));
}

export type PodcastRecorderHandle = {
  dbId: number;
  appendChunk: (blob: Blob, index: number) => Promise<void>;
  finalize: () => Promise<void>;
  discard: () => Promise<void>;
};

async function create(opts: { sessionId: string; participantName: string; mime: string; ext: string }): Promise<PodcastRecorderHandle> {
  const db = await openDb();
  const dbId = await tx(db, [STORE_SESSIONS], "readwrite", (t) => new Promise<number>((res, rej) => {
    const row: Omit<RecoverySessionRow, "id"> = {
      sessionId: opts.sessionId,
      participantName: opts.participantName,
      mime: opts.mime,
      ext: opts.ext,
      startedAt: Date.now(),
      lastUpdated: Date.now(),
      finalized: false,
    };
    const r = t.objectStore(STORE_SESSIONS).add(row);
    r.onsuccess = () => res(r.result as number);
    r.onerror = () => rej(r.error);
  }));

  return {
    dbId,
    async appendChunk(blob, index) {
      const d = await openDb();
      await tx(d, [STORE_CHUNKS, STORE_SESSIONS], "readwrite", (t) => new Promise<void>((res, rej) => {
        const cReq = t.objectStore(STORE_CHUNKS).add({ sessionDbId: dbId, index, blob });
        cReq.onerror = () => rej(cReq.error);
        const sStore = t.objectStore(STORE_SESSIONS);
        const gReq = sStore.get(dbId);
        gReq.onsuccess = () => {
          const row = gReq.result as RecoverySessionRow | undefined;
          if (row) { row.lastUpdated = Date.now(); sStore.put(row); }
          res();
        };
      }));
    },
    async finalize() {
      const d = await openDb();
      await tx(d, [STORE_SESSIONS], "readwrite", (t) => new Promise<void>((res) => {
        const s = t.objectStore(STORE_SESSIONS);
        const g = s.get(dbId);
        g.onsuccess = () => {
          const row = g.result as RecoverySessionRow | undefined;
          if (row) { row.finalized = true; row.lastUpdated = Date.now(); s.put(row); }
          res();
        };
      }));
    },
    async discard() { await discard(dbId); },
  };
}

export const PodcastRecovery = { create, listUnfinished, listAll, assembleBlob, discard };
