// Per-session shared state for the /studio V2 prototype.
// Uses Supabase Realtime (broadcast) so engineer + artist on DIFFERENT
// devices stay in sync. localStorage is kept as a same-tab cache only.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArtistSessionStatus {
  micLive: boolean;
  cameraOn: boolean;
  headphonesOk: boolean;
  artistCanHearBeat: boolean;
  hqReady: boolean;
  artistReady: boolean;
  joinedAt: number | null;
  /** 0–100. Real mic RMS measured on the artist tab; engineer reads it. */
  micLevel: number;
  /** 0–100. Real DAW return level from the helper. */
  dawReturnLevel: number;
}

export const defaultArtistStatus: ArtistSessionStatus = {
  micLive: false,
  cameraOn: false,
  headphonesOk: false,
  artistCanHearBeat: false,
  hqReady: false,
  artistReady: false,
  joinedAt: null,
  micLevel: 0,
  dawReturnLevel: 0,
};

const storageKey = (sid: string) => `studio.v2.session.${sid}.artist`;
const channelName = (sid: string) => `studio-v2-session-${sid.trim()}`;
const EVENT_STATE = "artist-state";
const EVENT_REQUEST = "artist-state-request";

function readStored(sid: string): ArtistSessionStatus {
  try {
    const raw = localStorage.getItem(storageKey(sid));
    if (raw) return { ...defaultArtistStatus, ...JSON.parse(raw) };
  } catch {}
  return defaultArtistStatus;
}

export function useArtistSessionSync(sessionId: string | undefined) {
  const [status, setStatus] = useState<ArtistSessionStatus>(() =>
    sessionId ? readStored(sessionId) : defaultArtistStatus,
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const pendingBroadcastRef = useRef<ArtistSessionStatus | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!sessionId) return;
    setStatus(readStored(sessionId));

    const channel = supabase.channel(channelName(sessionId), {
      config: { broadcast: { ack: false, self: false } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;

    channel
      .on("broadcast", { event: EVENT_STATE }, ({ payload }) => {
        if (payload && typeof payload === "object") {
          setStatus((prev) => {
            const next = { ...prev, ...(payload as Partial<ArtistSessionStatus>) };
            try { localStorage.setItem(storageKey(sessionId), JSON.stringify(next)); } catch {}
            return next;
          });
        }
      })
      .on("broadcast", { event: EVENT_REQUEST }, () => {
        // Re-broadcast current snapshot for late joiners.
        if (subscribedRef.current) {
          void channel.send({
            type: "broadcast",
            event: EVENT_STATE,
            payload: statusRef.current,
          });
        }
      })
      .subscribe((s) => {
        subscribedRef.current = s === "SUBSCRIBED";
        if (subscribedRef.current) {
          // Ask peers for the latest state.
          void channel.send({ type: "broadcast", event: EVENT_REQUEST, payload: {} });
          if (pendingBroadcastRef.current) {
            void channel.send({
              type: "broadcast",
              event: EVENT_STATE,
              payload: pendingBroadcastRef.current,
            });
            pendingBroadcastRef.current = null;
          }
        }
      });

    // Same-tab cross-component sync (cheap, no realtime hop).
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(sessionId) && e.newValue) {
        try { setStatus({ ...defaultArtistStatus, ...JSON.parse(e.newValue) }); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      subscribedRef.current = false;
      pendingBroadcastRef.current = null;
    };
  }, [sessionId]);

  const update = useCallback(
    (patch: Partial<ArtistSessionStatus>) => {
      if (!sessionId) return;
      setStatus((prev) => {
        const next = { ...prev, ...patch };
        try { localStorage.setItem(storageKey(sessionId), JSON.stringify(next)); } catch {}
        const channel = channelRef.current;
        if (channel && subscribedRef.current) {
          void channel.send({
            type: "broadcast",
            event: EVENT_STATE,
            payload: next,
          });
        } else {
          pendingBroadcastRef.current = next;
        }
        const onlyMeters =
          Object.keys(patch).length > 0 &&
          Object.keys(patch).every((k) => k === "micLevel" || k === "dawReturnLevel");
        if (!onlyMeters) {
          // eslint-disable-next-line no-console
          console.log("[/studio] SESSION_STATE_UPDATED", sessionId, patch);
        }
        return next;
      });
    },
    [sessionId],
  );

  return { status, update };
}
