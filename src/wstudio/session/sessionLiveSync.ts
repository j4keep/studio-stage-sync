import { supabase } from "@/integrations/supabase/client";

export type SessionLiveState = {
  recording: boolean;
  engineerPtt: boolean;
  artistPtt: boolean;
  screenShareActive: boolean;
  artistMuted: boolean;
  artistJoined: boolean;
  engineerJoined: boolean;
};

const EVT = "wstudio-session-live-sync";

type LiveChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  subscribed: boolean;
};

const liveChannels = new Map<string, LiveChannelEntry>();

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
    artistJoined: false,
    engineerJoined: false,
  };
}

function persistLive(sessionId: string, state: SessionLiveState) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function emitLive(sessionId: string, state: SessionLiveState) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { sessionId, state } }));
}

function ensureLiveChannel(sessionId: string): LiveChannelEntry {
  const id = sessionId.trim();
  const existing = liveChannels.get(id);
  if (existing) return existing;

  const channel = supabase.channel(`wstudio-live-${id}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  const entry: LiveChannelEntry = {
    channel,
    refCount: 0,
    subscribed: false,
  };

  channel
    .on("broadcast", { event: "state" }, ({ payload }) => {
      const next = { ...defaultLiveState(), ...(payload as Partial<SessionLiveState>) };
      persistLive(id, next);
      emitLive(id, next);
    })
    .subscribe((status) => {
      entry.subscribed = status === "SUBSCRIBED";
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        entry.subscribed = false;
      }
    });

  liveChannels.set(id, entry);
  return entry;
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
  const id = sessionId.trim();
  if (!id) return defaultLiveState();

  const next = { ...readLive(id), ...patch };
  persistLive(id, next);
  emitLive(id, next);

  const entry = ensureLiveChannel(id);
  const sendBroadcast = () =>
    entry.channel.send({
      type: "broadcast",
      event: "state",
      payload: next,
    });

  if (entry.subscribed) {
    void sendBroadcast();
  } else {
    window.setTimeout(() => {
      const current = liveChannels.get(id);
      if (current?.subscribed) {
        void current.channel.send({
          type: "broadcast",
          event: "state",
          payload: next,
        });
      }
    }, 150);
  }

  return next;
}

export function subscribeLive(sessionId: string, cb: (s: SessionLiveState) => void): () => void {
  const id = sessionId.trim();
  if (!id) {
    cb(defaultLiveState());
    return () => {};
  }

  const entry = ensureLiveChannel(id);
  entry.refCount += 1;

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

    const current = liveChannels.get(id);
    if (!current) return;

    current.refCount -= 1;
    if (current.refCount <= 0) {
      liveChannels.delete(id);
      void supabase.removeChannel(current.channel);
    }
  };
}
