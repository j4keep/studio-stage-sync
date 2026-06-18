import { create } from "zustand";

/**
 * Podcast video store — keeps a Blob of recorded/uploaded video per DAW clip.
 * Lives in-memory only; serialized into the project .json on Save (base64).
 * Independent of Supabase/R2 — everything stays on the user's device.
 */
export type PodcastVideoEntry = {
  blob: Blob;
  url: string;          // object URL for <video> playback
  mime: string;
  durationSec?: number;
  participantLabel?: string; // "Host", "Guest 1", ...
};

type PodcastVideoState = {
  /** key: DAW clip id -> video data */
  videos: Record<string, PodcastVideoEntry>;
  setVideo: (clipId: string, entry: Omit<PodcastVideoEntry, "url"> & { url?: string }) => void;
  removeVideo: (clipId: string) => void;
  clear: () => void;
};

export const usePodcastVideoStore = create<PodcastVideoState>((set, get) => ({
  videos: {},
  setVideo: (clipId, entry) => {
    const prev = get().videos[clipId];
    if (prev?.url) {
      try { URL.revokeObjectURL(prev.url); } catch {}
    }
    const url = entry.url ?? URL.createObjectURL(entry.blob);
    set(s => ({ videos: { ...s.videos, [clipId]: { ...entry, url } } }));
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
  clear: () => {
    for (const v of Object.values(get().videos)) {
      if (v.url) { try { URL.revokeObjectURL(v.url); } catch {} }
    }
    set({ videos: {} });
  },
}));
