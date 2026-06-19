import { create } from "zustand";

/**
 * Keeps the podcast studio alive across route changes so navigating to Home /
 * Feed / TV / Profile does NOT stop the recording. Only `close()` (Leave) ends
 * the session and unmounts the studio.
 */
type PodcastSessionState = {
  active: boolean;
  minimized: boolean;
  open: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
};

export const usePodcastSession = create<PodcastSessionState>((set) => ({
  active: false,
  minimized: false,
  open: () => set({ active: true, minimized: false }),
  close: () => set({ active: false, minimized: false }),
  minimize: () => set({ minimized: true }),
  restore: () => set({ minimized: false, active: true }),
}));
