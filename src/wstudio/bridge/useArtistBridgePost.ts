import { useEffect, useRef, useState } from "react";

/**
 * Artist-side direct POST relay to the engineer's W.STUDIO bridge.
 *
 *   POST http://<ENGINEER_LAN_IP>:47999/artist-audio?slot=<slot>
 *
 * The artist browser captures the local mic and POSTs PCM packets directly
 * to the engineer's LAN IP. The engineer's AU plugin (on the same engineer
 * Mac, listening on 127.0.0.1:47999) receives the packets.
 *
 * Notes:
 *  - When the Lovable preview is served over HTTPS, browsers will block
 *    HTTP requests to a private LAN IP (Mixed Content). For that case the
 *    user must run the artist page over HTTP/localhost, or the engineer
 *    bridge must terminate TLS. We surface the fetch error so the operator
 *    can see what's happening.
 *  - When `engineerHost` is empty, the hook stays idle (no fetches).
 */
const PACKET_SAMPLES = 2048; // ~42.7 ms @ 48k
const MAX_INFLIGHT = 1;
const RECENT_OK_MS = 5000;

export type ArtistBridgePostState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface ArtistBridgePostStats {
  enabled: boolean;
  targetUrl: string;
  level: number;
  packetsPosted: number;
  packetsFailed: number;
  packetsDropped: number;
  lastStatus: string | null;
  lastError: string | null;
  state: ArtistBridgePostState;
  sending: boolean;
}

const EMPTY: ArtistBridgePostStats = {
  enabled: false,
  targetUrl: "",
  level: 0,
  packetsPosted: 0,
  packetsFailed: 0,
  packetsDropped: 0,
  lastStatus: null,
  lastError: null,
  state: "DISCONNECTED",
  sending: false,
};

export function useArtistBridgePost(
  stream: MediaStream | null,
  engineerHost: string,
  slot: number,
  enabled: boolean,
): ArtistBridgePostStats {
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
  const lastLog = useRef(0);

  const targetUrl =
    engineerHost.trim().length > 0
      ? `http://${engineerHost.trim()}:47999/artist-audio?slot=${slot}`
      : "";

  const [stats, setStats] = useState<ArtistBridgePostStats>(() => ({
    ...EMPTY,
    enabled,
    targetUrl,
  }));

  useEffect(() => {
    if (!enabled || !stream || !targetUrl) {
      inflight.current = 0;
      consecFails.current = 0;
      levelRef.current = 0;
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
    src.connect(node);
    node.connect(muteSink);
    muteSink.connect(ctx.destination);

    setStats((s) => ({ ...s, enabled: true, state: "CONNECTING", targetUrl }));

    node.onaudioprocess = (ev) => {
      if (cancelled) return;
      const ch = ev.inputBuffer.getChannelData(0);
      const samples = new Array(ch.length);
      let sumSq = 0;
      // Input trim multiplier applied to all outgoing PCM samples.
      const TRIM = 0.08;
      // Hard safety clamp ±0.8 after trim. No upward normalization, no auto-gain.
      const CEIL = 0.8;
      for (let i = 0; i < ch.length; i++) {
        let s = ch[i] * TRIM;
        if (s > CEIL) s = CEIL;
        else if (s < -CEIL) s = -CEIL;
        samples[i] = s;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / ch.length);
      levelRef.current = Math.min(1, rms * 6);

      if (inflight.current >= MAX_INFLIGHT) {
        dropCount.current++;
        return;
      }
      const now = performance.now();
      if (consecFails.current >= 5 && now < nextProbeAt.current) {
        dropCount.current++;
        return;
      }

      inflight.current++;
      const body = JSON.stringify({ sampleRate: ctx.sampleRate, slot, samples });
      fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        mode: "cors",
      })
        .then((res) => {
          lastStatus.current = `HTTP ${res.status} ${res.statusText}`;
          if (!res.ok) throw new Error(lastStatus.current ?? `HTTP ${res.status}`);
          postCount.current++;
          consecFails.current = 0;
          nextProbeAt.current = 0;
          lastOkAt.current = performance.now();
          lastErr.current = null;
        })
        .catch((err) => {
          failCount.current++;
          consecFails.current++;
          lastErr.current = err?.message ?? String(err);
          const backoff = Math.min(5000, 500 * Math.pow(2, Math.max(0, consecFails.current - 5)));
          nextProbeAt.current = performance.now() + backoff;
          const t = performance.now();
          if (t - lastLog.current > 5000) {
            lastLog.current = t;
            // eslint-disable-next-line no-console
            console.warn("artist-bridge POST failed (backing off)", lastErr.current);
          }
        })
        .finally(() => {
          inflight.current = Math.max(0, inflight.current - 1);
        });
    };

    const tick = window.setInterval(() => {
      if (cancelled) return;
      const now = performance.now();
      const okRecently = lastOkAt.current > 0 && now - lastOkAt.current < RECENT_OK_MS;
      const state: ArtistBridgePostState =
        consecFails.current >= 8 && !okRecently
          ? "DISCONNECTED"
          : okRecently
            ? "CONNECTED"
            : "CONNECTING";
      setStats({
        enabled: true,
        targetUrl,
        level: levelRef.current,
        packetsPosted: postCount.current,
        packetsFailed: failCount.current,
        packetsDropped: dropCount.current,
        lastStatus: lastStatus.current,
        lastError: lastErr.current,
        state,
        sending: okRecently,
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      try { node.onaudioprocess = null as unknown as (ev: AudioProcessingEvent) => void; } catch {/* noop */}
      try { src.disconnect(); } catch {/* noop */}
      try { node.disconnect(); } catch {/* noop */}
      try { muteSink.disconnect(); } catch {/* noop */}
      void ctx.close().catch(() => {});
      inflight.current = 0;
    };
  }, [stream, slot, enabled, targetUrl]);

  return stats;
}
