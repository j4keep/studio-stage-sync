// Lightweight per-session shared state for the /studio V2 prototype.
// Uses localStorage + BroadcastChannel so Engineer and Artist tabs in the
// same browser stay in sync without any backend. Scoped per sessionId.

import { useEffect, useState, useCallback, useRef } from "react";

export interface ArtistSessionStatus {
  micLive: boolean;
  cameraOn: boolean;
  headphonesOk: boolean;
  artistCanHearBeat: boolean;
  hqReady: boolean;
  artistReady: boolean;
  joinedAt: number | null;
  /** 0–100. Real mic RMS measured on the artist tab; engineer reads it for the input meter. */
  micLevel: number;
  /** 0–100. Real DAW return level from the helper; 0 until helper emits real data. */
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
const channelName = (sid: string) => `studio-v2-session-${sid}`;

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
  const chanRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setStatus(readStored(sessionId));
    const chan = new BroadcastChannel(channelName(sessionId));
    chanRef.current = chan;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "artist-status" && e.data.payload) {
        setStatus((prev) => ({ ...prev, ...e.data.payload }));
      }
      if (e.data?.type === "artist-status-request") {
        // Re-broadcast current snapshot for late joiners
        chan.postMessage({ type: "artist-status", payload: readStored(sessionId) });
      }
    };
    chan.addEventListener("message", onMsg);
    // Cross-tab via storage event (BroadcastChannel covers same-origin tabs too)
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(sessionId) && e.newValue) {
        try { setStatus({ ...defaultArtistStatus, ...JSON.parse(e.newValue) }); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    // Ask any peer to re-broadcast latest
    chan.postMessage({ type: "artist-status-request" });
    return () => {
      chan.removeEventListener("message", onMsg);
      chan.close();
      window.removeEventListener("storage", onStorage);
      chanRef.current = null;
    };
  }, [sessionId]);

  const update = useCallback(
    (patch: Partial<ArtistSessionStatus>) => {
      if (!sessionId) return;
      setStatus((prev) => {
        const next = { ...prev, ...patch };
        try { localStorage.setItem(storageKey(sessionId), JSON.stringify(next)); } catch {}
        chanRef.current?.postMessage({ type: "artist-status", payload: next });
        return next;
      });
    },
    [sessionId],
  );

  return { status, update };
}
