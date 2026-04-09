/** Local preview: no WebRTC/backend required. */
export const WSTUDIO_DEMO_MODE = true;

/** Quick Join on session join page (no booking) — testing only until booking is required. */
export const WSTUDIO_QUICK_JOIN = true;

export function generateMockSessionId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEMO_SESSION_TITLE = "Live with Jay — Florida";

export const DEMO_TIMER_MINUTES = 120;
