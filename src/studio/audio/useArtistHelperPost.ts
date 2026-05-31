import { useEffect, useRef, useState } from "react";
import { getActiveHelperTransport, HttpHelperTransport } from "@/wstudio/audio-engine/helper";

/**
 * Artist-side direct POST relay to the W.STUDIO Helper App.
 *
 *   POST http://127.0.0.1:48000/artist-audio?slot=<slot>
 *
 * Mirrors @/wstudio/bridge/useArtistBridgePost but targets the Helper App
 * (port 48000) so artist mic audio is fed into the same transport that
 * carries plugin events. Used by /studio's ArtistRoom; /wstudio is untouched.
 */

const PACKET_SAMPLES = 2048;
const MAX_INFLIGHT = 1;
const RECENT_OK_MS = 5000;

export type ArtistHelperPostState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface ArtistHelperPostStats {
  enabled: boolean;
  targetUrl: string;
  level: number;
  packetsPosted: number;
  packetsFailed: number;
  packetsDropped: number;
  lastStatus: string | null;
  lastError: string | null;
  state: ArtistHelperPostState;
  sending: boolean;
}

const EMPTY: ArtistHelperPostStats = {
  enabled: false, targetUrl: "", level: 0,
  packetsPosted: 0, packetsFailed: 0, packetsDropped: 0,
  lastStatus: null, lastError: null, state: "DISCONNECTED", sending: false,
};

export function useArtistHelperPost(
  stream: MediaStream | null,
  slot: number,
  enabled: boolean,
): ArtistHelperPostStats {
  const helper = getActiveHelperTransport();
  const targetUrl =
    helper instanceof HttpHelperTransport
      ? helper.artistAudioUrl(slot)
      : `http://127.0.0.1:48000/artist-audio?slot=${slot}`;

  const inflight = useRef(0);
  const postCount = useRef(0);
  const failCount = useRef(0);
  const dropCount = useRef(0);
  const consecFails = useRef(0);
  const nextProbeAt = useRef(0);
  const levelRef = useRef(0);
  const lastOkAt = useRef(0);
  const lastErr = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  const [stats, setStats] = useState<ArtistHelperPostStats>(() => ({
    ...EMPTY, enabled, targetUrl,
  }));

  useEffect(() => {
    if (!enabled || !stream || !targetUrl) {
      inflight.current = 0; consecFails.current = 0; levelRef.current = 0;
      setStats({ ...EMPTY, enabled, targetUrl });
      return;
    }
    const track = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) {
      setStats((s) => ({ ...s, enabled, targetUrl, state: "DISCONNECTED" }));
      return;
    }

    let cancelled = false;
    const Ctx: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});

    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const node = ctx.createScriptProcessor(PACKET_SAMPLES, 1, 1);
    const muteSink = ctx.createGain();
    muteSink.gain.value = 0;
    src.connect(node); node.connect(muteSink); muteSink.connect(ctx.destination);

    setStats((s) => ({ ...s, enabled: true, state: "CONNECTING", targetUrl }));

    node.onaudioprocess = (ev) => {
      if (cancelled) return;
      const ch = ev.inputBuffer.getChannelData(0);
      const samples = new Array<number>(ch.length);
      let sumSq = 0;
      for (let i = 0; i < ch.length; i++) {
        const s = ch[i]; samples[i] = s; sumSq += s * s;
      }
      levelRef.current = Math.min(1, Math.sqrt(sumSq / ch.length) * 1.8);

      if (inflight.current >= MAX_INFLIGHT) { dropCount.current++; return; }
      const now = performance.now();
      if (consecFails.current >= 5 && now < nextProbeAt.current) { dropCount.current++; return; }

      inflight.current++;
      const body = JSON.stringify({
        samples,
        sampleRate: ctx.sampleRate,
        slot,
        timestamp: Date.now(),
      });
      if (import.meta.env.DEV && postCount.current % 25 === 0) {
        // eslint-disable-next-line no-console
        console.log("[studio] POST /artist-audio sampleCount=", samples.length, "slot=", slot);
      }
      fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body, cache: "no-store", mode: "cors",
      })
        .then((res) => {
          lastStatus.current = `HTTP ${res.status} ${res.statusText}`;
          if (!res.ok) throw new Error(lastStatus.current ?? `HTTP ${res.status}`);
          postCount.current++; consecFails.current = 0; nextProbeAt.current = 0;
          lastOkAt.current = performance.now(); lastErr.current = null;
        })
        .catch((err) => {
          failCount.current++; consecFails.current++;
          lastErr.current = err?.message ?? String(err);
          if (import.meta.env.DEV && consecFails.current <= 3) {
            // eslint-disable-next-line no-console
            console.warn("[studio] POST /artist-audio failed:", lastErr.current);
          }
          const backoff = Math.min(5000, 500 * Math.pow(2, Math.max(0, consecFails.current - 5)));
          nextProbeAt.current = performance.now() + backoff;
        })
        .finally(() => { inflight.current = Math.max(0, inflight.current - 1); });
    };

    const tick = window.setInterval(() => {
      if (cancelled) return;
      const now = performance.now();
      const okRecently = lastOkAt.current > 0 && now - lastOkAt.current < RECENT_OK_MS;
      const state: ArtistHelperPostState =
        consecFails.current >= 8 && !okRecently ? "DISCONNECTED" :
        okRecently ? "CONNECTED" : "CONNECTING";
      setStats({
        enabled: true, targetUrl,
        level: levelRef.current,
        packetsPosted: postCount.current,
        packetsFailed: failCount.current,
        packetsDropped: dropCount.current,
        lastStatus: lastStatus.current,
        lastError: lastErr.current,
        state, sending: okRecently,
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      try { node.onaudioprocess = null as unknown as (ev: AudioProcessingEvent) => void; } catch { /* noop */ }
      try { src.disconnect(); } catch { /* noop */ }
      try { node.disconnect(); } catch { /* noop */ }
      try { muteSink.disconnect(); } catch { /* noop */ }
      void ctx.close().catch(() => {});
    };
  }, [enabled, stream, targetUrl, slot]);

  return stats;
}
