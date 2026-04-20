/**
 * Local UI preview without booking backend.
 * Set `VITE_WSTUDIO_DEMO=true` in `.env` for demo; omit or false for real sessions + DB sync.
 */
export const WSTUDIO_DEMO_MODE = import.meta.env.VITE_WSTUDIO_DEMO === "true";

export function generateMockSessionId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEMO_SESSION_TITLE = "Live with Jay — Florida";

export const DEMO_TIMER_MINUTES = 120;
