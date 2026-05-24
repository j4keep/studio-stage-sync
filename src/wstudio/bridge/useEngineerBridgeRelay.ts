import { useEffect, useRef, useState } from "react";

/**
 * Engineer-side bridge relay.
 *
 * Taps the **remote artist audio** that arrives over the existing W.STUDIO
 * WebRTC session and re-publishes it to the locally-running JUCE AU plugin
 * bridge over plain HTTP loopback:
 *
 *   POST http://127.0.0.1:47999/artist-audio?slot=<slot>
 *   { "sampleRate": <hz>, "slot": <n>, "samples": [-1..1, ...] }
 *
 * Why loopback (127.0.0.1) on the engineer machine:
 *   - artist browser never has to reach the engineer's private LAN IP,
 *   - no Chrome HTTPS → HTTP Mixed Content block (the only POST origin is
 *     the engineer's own browser hitting 127.0.0.1, which Chrome treats as
 *     a Secure Context exception),
 *   - the plugin port stays bound to the engineer's machine.
 *
 * Returns live diagnostics: remote signal level, packets posted, last HTTP
 * status, last fetch error.
 */
const BRIDGE_URL = (slot: number) => `http://127.0.0.1:47999/artist-audio?slot=${slot}`;
const PACKET_SAMPLES = 512; // ~10.7ms @ 48k
const MAX_INFLIGHT = 8;

export type EngineerRelayState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface EngineerBridgeRelayStats {
  enabled: boolean;
  /** Endpoint we POST to (informational). */
  targetUrl: string;
  /** Remote artist RMS level (0–1) on the relayed audio. */
  remoteLevel: number;
  /** Successful POSTs since mount. */
  packetsPosted: number;
  /** Failed fetches since mount. */
  packetsFailed: number;
  /** Dropped (backpressure) packets. */
  packetsDropped: number;
  /** Last HTTP status text returned by the plugin bridge (e.g. "200 OK"). */
  lastStatus: string | null;
  /** Last exact fetch / HTTP error message. */
  lastError: string | null;
  state: EngineerRelayState;
  /** True when a POST succeeded in the last ~1.5s. */
  sending: boolean;
  /** True when the remote artist stream has a live audio track. */
  hasRemoteAudio: boolean;
}

const EMPTY_STATS: EngineerBridgeRelayStats = {
  enabled: false,
  targetUrl: BRIDGE_URL(0),
  remoteLevel: 0,
  packetsPosted: 0,
  packetsFailed: 0,
  packetsDropped: 0,
  lastStatus: null,
  lastError: null,
  state: "DISCONNECTED",
  sending: false,
  hasRemoteAudio: false,
};

export function useEngineerBridgeRelay(
  remoteStream: MediaStream | null,
  slot: number = 0,
  enabled: boolean = true,
): EngineerBridgeRelayStats {
  const inflightRef = useRef(0);
  const postCountRef = useRef(0);
  const failCountRef = useRef(0);
  const droppedRef = useRef(0);
  const consecutiveFailRef = useRef(0);
  const levelRef = useRef(0);
  const lastOkAtRef = useRef(0);
  const lastErrorRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const lastErrorLogRef = useRef(0);
  const announcedRef = useRef(false);

  const targetUrl = BRIDGE_URL(slot);

  const [stats, setStats] = useState<EngineerBridgeRelayStats>(() => ({
    ...EMPTY_STATS,
    enabled,
    targetUrl,
  }));

  useEffect(() => {
    if (!enabled || !remoteStream) {
      inflightRef.current = 0;
      consecutiveFailRef.current = 0;
      levelRef.current = 0;
      announcedRef.current = false;
      setStats({ ...EMPTY_STATS, enabled, targetUrl, hasRemoteAudio: !!remoteStream });
      return;
    }

    const track = remoteStream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) {
      setStats((s) => ({ ...s, enabled, hasRemoteAudio: false, state: "DISCONNECTED" }));
      return;
    }

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

    setStats((s) => ({ ...s, enabled: true, hasRemoteAudio: true, state: "CONNECTING", targetUrl }));

    node.onaudioprocess = (ev) => {
      if (cancelled) return;
      const ch = ev.inputBuffer.getChannelData(0);

      const samples = new Array(ch.length);
      let sumSq = 0;
      for (let i = 0; i < ch.length; i++) {
        const s = ch[i];
        samples[i] = s;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / ch.length);
      levelRef.current = Math.min(1, rms * 1.8);

      if (inflightRef.current >= MAX_INFLIGHT) {
        droppedRef.current++;
        return;
      }

      if (!announcedRef.current) {
        announcedRef.current = true;
        // eslint-disable-next-line no-console
        console.log(`WSTUDIO engineer relay active → ${targetUrl} (sampleRate ${ctx.sampleRate})`);
      }

      inflightRef.current++;
      const body = JSON.stringify({ sampleRate: ctx.sampleRate, slot, samples });

      fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        cache: "no-store",
        mode: "cors",
      })
        .then((res) => {
          lastStatusRef.current = `HTTP ${res.status} ${res.statusText}`;
          if (!res.ok) throw new Error(lastStatusRef.current ?? `HTTP ${res.status}`);
          postCountRef.current++;
          consecutiveFailRef.current = 0;
          lastOkAtRef.current = performance.now();
          lastErrorRef.current = null;
        })
        .catch((err) => {
          failCountRef.current++;
          consecutiveFailRef.current++;
          lastErrorRef.current = err?.message ?? String(err);
          const now = performance.now();
          if (now - lastErrorLogRef.current > 2000) {
            lastErrorLogRef.current = now;
            // eslint-disable-next-line no-console
            console.warn("engineer-relay POST failed", lastErrorRef.current);
          }
        })
        .finally(() => {
          inflightRef.current = Math.max(0, inflightRef.current - 1);
        });
    };

    const tick = window.setInterval(() => {
      if (cancelled) return;
      const now = performance.now();
      const okRecently = lastOkAtRef.current > 0 && now - lastOkAtRef.current < 1500;
      const state: EngineerRelayState =
        consecutiveFailRef.current >= 3 && !okRecently
          ? "DISCONNECTED"
          : okRecently
            ? "CONNECTED"
            : "CONNECTING";
      setStats({
        enabled: true,
        targetUrl,
        remoteLevel: levelRef.current,
        packetsPosted: postCountRef.current,
        packetsFailed: failCountRef.current,
        packetsDropped: droppedRef.current,
        lastStatus: lastStatusRef.current,
        lastError: lastErrorRef.current,
        state,
        sending: okRecently,
        hasRemoteAudio: true,
      });
    }, 150);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      try { node.onaudioprocess = null as any; } catch {}
      try { src.disconnect(); } catch {}
      try { node.disconnect(); } catch {}
      try { muteSink.disconnect(); } catch {}
      void ctx.close().catch(() => {});
      inflightRef.current = 0;
      announcedRef.current = false;
    };
  }, [remoteStream, slot, enabled, targetUrl]);

  return stats;
}
