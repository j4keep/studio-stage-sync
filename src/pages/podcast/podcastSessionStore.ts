import { create } from "zustand";

/**
 * Keeps the podcast studio alive across route changes so navigating to Home /
 * Feed / TV / Profile does NOT stop the recording. Only `close()` (Leave) ends
 * the session and unmounts the studio.
 */
type PodcastSessionState = {
  active: boolean;
  minimized: boolean;
  sessionCode: string | null;
  open: (sessionCode?: string | null) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  setSessionCode: (sessionCode: string | null) => void;
};

export const usePodcastSession = create<PodcastSessionState>((set) => ({
  active: false,
  minimized: false,
  sessionCode: null,
  open: (sessionCode) => set((state) => ({ active: true, minimized: false, sessionCode: sessionCode ?? state.sessionCode })),
  close: () => set({ active: false, minimized: false, sessionCode: null }),
  minimize: () => set({ minimized: true }),
  restore: () => set({ minimized: false, active: true }),
  setSessionCode: (sessionCode) => set({ sessionCode }),
}));
