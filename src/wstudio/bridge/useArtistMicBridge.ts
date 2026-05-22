import { useEffect, useRef, useState } from "react";

/**
 * Captures the local artist mic from a MediaStream and POSTs mono float PCM
 * to the JUCE plugin's local HTTP bridge in small packets.
 *
 *   POST http://192.168.12.155:47999/artist-audio?slot=<slot>
 *   { "samples": [-1..1, ...] }
 *
 * No WebRTC. Plain HTTP loopback. Pairs with the GET /plugin-audio poll the engineer uses.
 *
 * Returns live diagnostics so the artist UI can render a bridge status panel
 * (connection state, outgoing mic level, packet counters, target URL).
 */
const DEFAULT_BRIDGE_HOST = "192.168.12.155:47999";
/**
 * Resolve the bridge host the artist browser should POST mic samples to.
 *
 * Priority:
 *   1. `?bridge=host:port` URL override (handy for quick LAN testing).
 *   2. `localStorage["wstudio.bridge.host"]` (set by the Local Bridge Test Mode UI).
 *   3. Hard-coded LAN default (`192.168.12.155:47999`).
 *
 * If the current page is loaded over HTTPS we honour the override too, but the
 * UI panel surfaces a clear Mixed-Content warning + "open over HTTP" CTA so the
 * artist can re-open the session from a same-protocol origin.
 */
function resolveBridgeHost(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("bridge");
    if (fromQuery) return fromQuery;
  } catch {}
  try {
    const fromStore = localStorage.getItem("wstudio.bridge.host");
    if (fromStore) return fromStore;
  } catch {}
  return DEFAULT_BRIDGE_HOST;
}
const PACKET_SAMPLES = 256; // ~5.8ms @ 44.1k — within the 128–512 / 10–25ms window
const MAX_INFLIGHT = 8;
const LOG_EVERY = 20; // log roughly every ~120ms of audio

export type ArtistBridgeConnection = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

export interface ArtistMicBridgeStats {
  connection: ArtistBridgeConnection;
  /** Most recent outgoing RMS level (0–1). */
  level: number;
  packetsSent: number;
  packetsFailed: number;
  packetsDropped: number;
  /** True when most recent POST succeeded. */
  sending: boolean;
  targetUrl: string;
  /** Display label for the engineer bridge endpoint (host:port form). */
  bridgeHost: string;
  slot: number;
  enabled: boolean;
  lastError: string | null;
}

export function useArtistMicBridge(
  stream: MediaStream | null,
  slot: number,
  enabled: boolean = true,
): ArtistMicBridgeStats {
  const announcedRef = useRef(false);
  const inflightRef = useRef(0);
  const lastErrorLogRef = useRef(0);
  const postCountRef = useRef(0);
  const failCountRef = useRef(0);
  const droppedRef = useRef(0);
  const consecutiveFailRef = useRef(0);
  const levelRef = useRef(0);
  const lastOkAtRef = useRef(0);
  const lastErrorMsgRef = useRef<string | null>(null);

  const targetUrl = `${BRIDGE_BASE}?slot=${slot}`;

  const [stats, setStats] = useState<ArtistMicBridgeStats>(() => ({
    connection: "DISCONNECTED",
    level: 0,
    packetsSent: 0,
    packetsFailed: 0,
    packetsDropped: 0,
    sending: false,
    targetUrl,
    bridgeHost: BRIDGE_HOST,
    slot,
    enabled,
    lastError: null,
  }));

  // Audio capture + HTTP posting effect.
  useEffect(() => {
    if (!enabled || !stream) {
      // Reset visible state when disabled.
      announcedRef.current = false;
      inflightRef.current = 0;
      consecutiveFailRef.current = 0;
      levelRef.current = 0;
      setStats((s) => ({
        ...s,
        connection: "DISCONNECTED",
        level: 0,
        sending: false,
        targetUrl,
        slot,
        enabled,
      }));
      return;
    }
    const track = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) return;

    let cancelled = false;
    const Ctx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const node = ctx.createScriptProcessor(PACKET_SAMPLES, 1, 1);
    const muteSink = ctx.createGain();
    muteSink.gain.value = 0;

    src.connect(node);
    node.connect(muteSink);
    muteSink.connect(ctx.destination);

    // Mark CONNECTING immediately so the UI doesn't sit on DISCONNECTED.
    setStats((s) => ({ ...s, connection: "CONNECTING", enabled: true, slot, targetUrl }));

    node.onaudioprocess = (ev) => {
      if (cancelled) return;
      const ch = ev.inputBuffer.getChannelData(0);

      // Compute RMS for the outgoing meter (always — even when backpressured).
      let sumSq = 0;
      for (let i = 0; i < ch.length; i++) sumSq += ch[i] * ch[i];
      const rms = Math.sqrt(sumSq / ch.length);
      levelRef.current = Math.min(1, rms * 1.8); // mild headroom boost for visibility

      if (inflightRef.current >= MAX_INFLIGHT) {
        droppedRef.current++;
        if (droppedRef.current % 50 === 0) {
          // eslint-disable-next-line no-console
          console.warn(`artist-audio bridge backpressure, dropped ${droppedRef.current} packets`);
        }
        return;
      }

      const samples = new Array(ch.length);
      for (let i = 0; i < ch.length; i++) samples[i] = ch[i];

      if (!announcedRef.current) {
        announcedRef.current = true;
        // eslint-disable-next-line no-console
        console.log(`WSTUDIO mic bridge active → ${targetUrl} (sampleRate ${ctx.sampleRate})`);
      }

      inflightRef.current++;
      const body = JSON.stringify({
        sampleRate: ctx.sampleRate,
        slot,
        samples,
      });
      fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        cache: "no-store",
        mode: "cors",
      })
        .then(() => {
          postCountRef.current++;
          consecutiveFailRef.current = 0;
          lastOkAtRef.current = performance.now();
          lastErrorMsgRef.current = null;
          if (postCountRef.current % LOG_EVERY === 0) {
            // eslint-disable-next-line no-console
            console.log(`POST artist-audio slot ${slot} samples: ${samples.length}`);
          }
        })
        .catch((err) => {
          failCountRef.current++;
          consecutiveFailRef.current++;
          lastErrorMsgRef.current = err?.message ?? String(err);
          const now = performance.now();
          if (now - lastErrorLogRef.current > 2000) {
            lastErrorLogRef.current = now;
            // eslint-disable-next-line no-console
            console.warn("artist-audio POST failed", lastErrorMsgRef.current);
          }
        })
        .finally(() => {
          inflightRef.current = Math.max(0, inflightRef.current - 1);
        });
    };

    // Lightweight refresh tick (~10Hz) so meter + counters update smoothly.
    const tick = window.setInterval(() => {
      if (cancelled) return;
      const now = performance.now();
      const okRecently = lastOkAtRef.current > 0 && now - lastOkAtRef.current < 1500;
      const connection: ArtistBridgeConnection =
        consecutiveFailRef.current >= 3 && !okRecently
          ? "DISCONNECTED"
          : okRecently
            ? "CONNECTED"
            : "CONNECTING";
      setStats({
        connection,
        level: levelRef.current,
        packetsSent: postCountRef.current,
        packetsFailed: failCountRef.current,
        packetsDropped: droppedRef.current,
        sending: okRecently,
        targetUrl,
        bridgeHost: BRIDGE_HOST,
        slot,
        enabled: true,
        lastError: lastErrorMsgRef.current,
      });
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      try { node.onaudioprocess = null as any; } catch {}
      try { src.disconnect(); } catch {}
      try { node.disconnect(); } catch {}
      try { muteSink.disconnect(); } catch {}
      void ctx.close().catch(() => {});
      announcedRef.current = false;
      inflightRef.current = 0;
      levelRef.current = 0;
    };
  }, [stream, slot, enabled, targetUrl]);

  return stats;
}
