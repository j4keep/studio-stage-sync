/** Local preview: no WebRTC/backend required. */
export const WSTUDIO_DEMO_MODE = true;

export function generateMockSessionId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEMO_SESSION_TITLE = "Live with Jay — Florida";

export const DEMO_TIMER_MINUTES = 120;
