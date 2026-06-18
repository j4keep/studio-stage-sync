import { create } from "zustand";

/**
 * Podcast video store — keeps a Blob of recorded/uploaded video per DAW clip.
 * Lives in-memory only; serialized into the project .wsproj on Save (base64).
 * Independent of Supabase/R2 — everything stays on the user's device.
 */
export type PodcastVideoEntry = {
  blob: Blob;
  url: string;          // object URL for <video> playback
  mime: string;
  durationSec?: number;
  participantLabel?: string;
};

export type PendingVideo = Omit<PodcastVideoEntry, "url"> & {
  trackId: string;
  startTime: number;
};

type PodcastVideoState = {
  /** key: DAW clip id -> video data */
  videos: Record<string, PodcastVideoEntry>;
  /** key: trackId -> pending video awaiting the engine's recorded clip id */
  pendingByTrack: Record<string, PendingVideo>;
  /** Clipboard copy used when DAW copy/cut/paste creates a fresh clip id. */
  clipVideoClipboard: Omit<PodcastVideoEntry, "url"> | null;
  setVideo: (clipId: string, entry: Omit<PodcastVideoEntry, "url"> & { url?: string }) => void;
  cloneVideo: (sourceClipId: string, targetClipId: string) => void;
  copyVideoToClipboard: (clipId: string) => void;
  pasteVideoFromClipboard: (targetClipId: string) => void;
  removeVideo: (clipId: string) => void;
  setPending: (trackId: string, entry: PendingVideo) => void;
  attachPending: (trackId: string, clipId: string) => void;
  clearPending: (trackId: string) => void;
  clear: () => void;
};

export const usePodcastVideoStore = create<PodcastVideoState>((set, get) => ({
  videos: {},
  pendingByTrack: {},
  clipVideoClipboard: null,
  setVideo: (clipId, entry) => {
    const prev = get().videos[clipId];
    if (prev?.url) { try { URL.revokeObjectURL(prev.url); } catch {} }
    const url = entry.url ?? URL.createObjectURL(entry.blob);
    set(s => ({ videos: { ...s.videos, [clipId]: { ...entry, url } } }));
  },
  cloneVideo: (sourceClipId, targetClipId) => {
    const src = get().videos[sourceClipId];
    if (!src || sourceClipId === targetClipId) return;
    const prev = get().videos[targetClipId];
    if (prev?.url) { try { URL.revokeObjectURL(prev.url); } catch {} }
    const { url: _oldUrl, ...copy } = src;
    set(s => ({ videos: { ...s.videos, [targetClipId]: { ...copy, url: URL.createObjectURL(src.blob) } } }));
  },
  copyVideoToClipboard: (clipId) => {
    const src = get().videos[clipId];
    if (!src) { set({ clipVideoClipboard: null }); return; }
    const { url: _oldUrl, ...copy } = src;
    set({ clipVideoClipboard: copy });
  },
  pasteVideoFromClipboard: (targetClipId) => {
    const src = get().clipVideoClipboard;
    if (!src) return;
    const prev = get().videos[targetClipId];
    if (prev?.url) { try { URL.revokeObjectURL(prev.url); } catch {} }
    set(s => ({ videos: { ...s.videos, [targetClipId]: { ...src, url: URL.createObjectURL(src.blob) } } }));
  },
  removeVideo: (clipId) => {
    const prev = get().videos[clipId];
    if (prev?.url) { try { URL.revokeObjectURL(prev.url); } catch {} }
    set(s => {
      const copy = { ...s.videos };
      delete copy[clipId];
      return { videos: copy };
    });
  },
  setPending: (trackId, entry) => {
    set(s => ({ pendingByTrack: { ...s.pendingByTrack, [trackId]: entry } }));
  },
  attachPending: (trackId, clipId) => {
    const pending = get().pendingByTrack[trackId];
    if (!pending) return;
    const url = URL.createObjectURL(pending.blob);
    set(s => {
      const pcopy = { ...s.pendingByTrack };
      delete pcopy[trackId];
      return {
        pendingByTrack: pcopy,
        videos: {
          ...s.videos,
          [clipId]: {
            blob: pending.blob,
            mime: pending.mime,
            durationSec: pending.durationSec,
            participantLabel: pending.participantLabel,
            url,
          },
        },
      };
    });
  },
  clearPending: (trackId) => {
    set(s => {
      const copy = { ...s.pendingByTrack };
      delete copy[trackId];
      return { pendingByTrack: copy };
    });
  },
  clear: () => {
    for (const v of Object.values(get().videos)) {
      if (v.url) { try { URL.revokeObjectURL(v.url); } catch {} }
    }
    set({ videos: {}, pendingByTrack: {}, clipVideoClipboard: null });
  },
}));

// ─────────────────────────────────────────────────────────────────
// Serialization helpers — embed video blobs into the project file
// ─────────────────────────────────────────────────────────────────

export type SerializedPodcastVideo = {
  mime: string;
  durationSec?: number;
  participantLabel?: string;
  base64: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      res(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function serializePodcastVideos(
  videos: Record<string, PodcastVideoEntry>,
): Promise<Record<string, SerializedPodcastVideo>> {
  const out: Record<string, SerializedPodcastVideo> = {};
  for (const [clipId, v] of Object.entries(videos)) {
    try {
      out[clipId] = {
        mime: v.mime,
        durationSec: v.durationSec,
        participantLabel: v.participantLabel,
        base64: await blobToBase64(v.blob),
      };
    } catch { /* skip */ }
  }
  return out;
}

export function hydratePodcastVideos(
  serialized: Record<string, SerializedPodcastVideo> | undefined,
) {
  const store = usePodcastVideoStore.getState();
  store.clear();
  if (!serialized) return;
  for (const [clipId, s] of Object.entries(serialized)) {
    const blob = base64ToBlob(s.base64, s.mime || "video/webm");
    store.setVideo(clipId, {
      blob,
      mime: s.mime,
      durationSec: s.durationSec,
      participantLabel: s.participantLabel,
    });
  }
}
