import { supabase } from "@/integrations/supabase/client";

export type RtcSignalRole = "artist" | "engineer";

export type RtcSignalPayload =
  | { t: "ready"; from: RtcSignalRole }
  | { t: "offer"; sdp: string; from: RtcSignalRole }
  | { t: "answer"; sdp: string; from: RtcSignalRole }
  | { t: "ice"; candidate: RTCIceCandidateInit; from: RtcSignalRole };

type SignalListener = (payload: RtcSignalPayload) => void;

type RtcChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<SignalListener>;
  pending: RtcSignalPayload[];
  refCount: number;
  subscribed: boolean;
};

const SIGNAL_EVENT = "signal";
const rtcChannels = new Map<string, RtcChannelEntry>();

function channelName(sessionId: string): string {
  return `wstudio-rtc-${sessionId.trim()}`;
}

function flushPending(sessionId: string, entry: RtcChannelEntry) {
  if (!entry.subscribed || entry.pending.length === 0) return;

  const pending = entry.pending.splice(0);
  for (const payload of pending) {
    void entry.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENT,
      payload,
    });
  }

  if (!rtcChannels.has(sessionId)) {
    entry.pending.length = 0;
  }
}

function ensureRtcChannel(sessionId: string): RtcChannelEntry {
  const id = sessionId.trim();
  const existing = rtcChannels.get(id);
  if (existing) return existing;

  const channel = supabase.channel(channelName(id), {
    config: { broadcast: { ack: false, self: false } },
  });

  const entry: RtcChannelEntry = {
    channel,
    listeners: new Set(),
    pending: [],
    refCount: 0,
    subscribed: false,
  };

  channel
    .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => {
      const message = payload as RtcSignalPayload;
      entry.listeners.forEach((listener) => listener(message));
    })
    .subscribe((status) => {
      entry.subscribed = status === "SUBSCRIBED";

      if (entry.subscribed) {
        flushPending(id, entry);
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        entry.subscribed = false;
      }
    });

  rtcChannels.set(id, entry);
  return entry;
}

export function sendRtcSignal(sessionId: string, payload: RtcSignalPayload) {
  const id = sessionId.trim();
  if (!id) return;

  const entry = ensureRtcChannel(id);
  if (entry.subscribed) {
    void entry.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENT,
      payload,
    });
    return;
  }

  entry.pending.push(payload);
  window.setTimeout(() => {
    const current = rtcChannels.get(id);
    if (current) flushPending(id, current);
  }, 150);
}

export function subscribeRtcSignals(sessionId: string, listener: SignalListener): () => void {
  const id = sessionId.trim();
  if (!id) return () => {};

  const entry = ensureRtcChannel(id);
  entry.refCount += 1;
  entry.listeners.add(listener);

  return () => {
    const current = rtcChannels.get(id);
    if (!current) return;

    current.listeners.delete(listener);
    current.refCount -= 1;

    if (current.refCount <= 0) {
      rtcChannels.delete(id);
      void supabase.removeChannel(current.channel);
    }
  };
}
