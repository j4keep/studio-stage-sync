import { supabase } from "@/integrations/supabase/client";

export type SessionLiveState = {
  recording: boolean;
  engineerPtt: boolean;
  artistPtt: boolean;
  screenShareActive: boolean;
  artistMuted: boolean;
  artistJoined: boolean;
  engineerJoined: boolean;
  /** Set by artist on join; shown on engineer bridge (not used in main session chrome). */
  remoteArtistLabel: string;
  /** Transport playback (UI sync; engineer drives) */
  playing: boolean;
  /** Record arm (engineer drives) */
  recordArmed: boolean;
  /** True after at least one completed record pass this session (placeholder take UI) */
  takeCapturedThisSession: boolean;
  /** Monitor mix 0–1 (engineer drives; artist read-only in UI) */
  vocalLevel: number;
  talkbackLevel: number;
  cueMix: number;
  /** Per-user headphone send to local output (not shared across roles) */
  headphoneLevelEngineer: number;
  headphoneLevelArtist: number;
};

const EVT = "wstudio-session-live-sync";

type LiveChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  subscribed: boolean;
  /** In-memory authoritative state for this session */
  state: SessionLiveState;
};

const liveChannels = new Map<string, LiveChannelEntry>();

export function defaultLiveState(): SessionLiveState {
  return {
    recording: false,
    engineerPtt: false,
    artistPtt: false,
    screenShareActive: false,
    artistMuted: false,
    artistJoined: false,
    engineerJoined: false,
    remoteArtistLabel: "",
    playing: false,
    recordArmed: false,
    takeCapturedThisSession: false,
    vocalLevel: 0.55,
    talkbackLevel: 0.45,
    cueMix: 0.5,
    headphoneLevelEngineer: 0.7,
    headphoneLevelArtist: 0.7,
  };
}

function emitLive(sessionId: string, state: SessionLiveState) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { sessionId, state } }));
}

function ensureLiveChannel(sessionId: string): LiveChannelEntry {
  const id = sessionId.trim();
  const existing = liveChannels.get(id);
  if (existing) return existing;

  const entry: LiveChannelEntry = {
    channel: null as any,
    refCount: 0,
    subscribed: false,
    state: defaultLiveState(),
  };

  const channel = supabase.channel(`wstudio-live-${id}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  entry.channel = channel;

  channel
    .on("broadcast", { event: "patch" }, ({ payload }) => {
      const raw = payload as Partial<SessionLiveState> & { headphoneLevel?: number };
      const patch: Partial<SessionLiveState> = { ...raw };
      if (typeof raw.headphoneLevel === "number") {
        if (patch.headphoneLevelEngineer === undefined) patch.headphoneLevelEngineer = raw.headphoneLevel;
        if (patch.headphoneLevelArtist === undefined) patch.headphoneLevelArtist = raw.headphoneLevel;
      }
      delete (patch as { headphoneLevel?: number }).headphoneLevel;
      entry.state = { ...entry.state, ...patch };
      emitLive(id, entry.state);
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
  const id = sessionId.trim();
  if (!id) return defaultLiveState();
  const entry = liveChannels.get(id);
  return entry ? { ...entry.state } : defaultLiveState();
}

export function writeLive(sessionId: string, patch: Partial<SessionLiveState>): SessionLiveState {
  const id = sessionId.trim();
  if (!id) return defaultLiveState();

  const entry = ensureLiveChannel(id);
  // Merge patch into our in-memory state
  entry.state = { ...entry.state, ...patch };
  // Emit locally
  emitLive(id, entry.state);

  // Broadcast ONLY the patch (not the full state) so the remote side merges it
  const sendPatch = () =>
    entry.channel.send({
      type: "broadcast",
      event: "patch",
      payload: patch,
    });

  if (entry.subscribed) {
    void sendPatch();
  } else {
    window.setTimeout(() => {
      const current = liveChannels.get(id);
      if (current?.subscribed) {
        void current.channel.send({
          type: "broadcast",
          event: "patch",
          payload: patch,
        });
      }
    }, 150);
  }

  return entry.state;
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

  window.addEventListener(EVT, onInternal);
  cb(entry.state);

  return () => {
    window.removeEventListener(EVT, onInternal);

    const current = liveChannels.get(id);
    if (!current) return;

    current.refCount -= 1;
    if (current.refCount <= 0) {
      liveChannels.delete(id);
      void supabase.removeChannel(current.channel);
    }
  };
}
