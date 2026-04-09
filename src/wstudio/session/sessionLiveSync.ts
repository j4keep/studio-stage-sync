/** Cross-tab / same-window sync for demo workflow (replace with signaling later). */

export type SessionLiveState = {
  recording: boolean;
  engineerPtt: boolean;
  artistPtt: boolean;
  screenShareActive: boolean;
  artistMuted: boolean;
};

const EVT = "wstudio-session-live-sync";

function storageKey(sessionId: string): string {
  return `wstudio_session_live_${sessionId.trim()}`;
}

export function defaultLiveState(): SessionLiveState {
  return {
    recording: false,
    engineerPtt: false,
    artistPtt: false,
    screenShareActive: false,
    artistMuted: false,
  };
}

export function readLive(sessionId: string): SessionLiveState {
  if (!sessionId.trim()) return defaultLiveState();
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return defaultLiveState();
    return { ...defaultLiveState(), ...JSON.parse(raw) };
  } catch {
    return defaultLiveState();
  }
}

export function writeLive(sessionId: string, patch: Partial<SessionLiveState>): SessionLiveState {
  if (!sessionId.trim()) return defaultLiveState();
  const next = { ...readLive(sessionId), ...patch };
  localStorage.setItem(storageKey(sessionId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { sessionId: sessionId.trim(), state: next } }));
  return next;
}

export function subscribeLive(sessionId: string, cb: (s: SessionLiveState) => void): () => void {
  const id = sessionId.trim();
  if (!id) {
    cb(defaultLiveState());
    return () => {};
  }

  const onInternal = (e: Event) => {
    const d = (e as CustomEvent<{ sessionId: string; state: SessionLiveState }>).detail;
    if (d?.sessionId === id) cb(d.state);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== storageKey(id) || !e.newValue) return;
    try {
      cb({ ...defaultLiveState(), ...JSON.parse(e.newValue) });
    } catch {
      /* ignore */
    }
  };

  window.addEventListener(EVT, onInternal);
  window.addEventListener("storage", onStorage);
  cb(readLive(id));

  return () => {
    window.removeEventListener(EVT, onInternal);
    window.removeEventListener("storage", onStorage);
  };
}
