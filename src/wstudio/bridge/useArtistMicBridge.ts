import { useEffect, useRef, useState } from "react";

/**
 * Artist-side **local mic** diagnostics.
 *
 * The artist mic is sent to the engineer via the existing W.STUDIO WebRTC
 * session — NOT via direct HTTP POST to the engineer's LAN IP. The engineer
 * side taps the inbound WebRTC artist audio and re-publishes it to the
 * locally-running JUCE AU plugin bridge over 127.0.0.1 loopback
 * (see `useEngineerBridgeRelay`).
 *
 * This hook therefore only measures the local mic level and reports
 * "sending to session" status. No fetch traffic is generated here, which
 * removes the previous Mixed-Content / private-IP failure modes on the
 * artist browser.
 */
export type ArtistBridgeConnection = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

export interface ArtistMicBridgeStats {
  connection: ArtistBridgeConnection;
  /** Most recent local mic RMS level (0–1). */
  level: number;
  /** Always 0 — artist no longer POSTs directly. */
  packetsSent: number;
  packetsFailed: number;
  packetsDropped: number;
  /** True when mic is live and unmuted. */
  sending: boolean;
  /** Informational label of the transport. */
  targetUrl: string;
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
  const levelRef = useRef(0);
  const [stats, setStats] = useState<ArtistMicBridgeStats>(() => ({
    connection: "DISCONNECTED",
    level: 0,
    packetsSent: 0,
    packetsFailed: 0,
    packetsDropped: 0,
    sending: false,
    targetUrl: "WebRTC session",
    bridgeHost: "session",
    slot,
    enabled,
    lastError: null,
  }));

  useEffect(() => {
    if (!enabled || !stream) {
      levelRef.current = 0;
      setStats((s) => ({
        ...s,
        connection: "DISCONNECTED",
        level: 0,
        sending: false,
        enabled,
        slot,
      }));
      return;
    }
    const track = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) {
      setStats((s) => ({ ...s, connection: "DISCONNECTED", sending: false, enabled, slot }));
      return;
    }

    let cancelled = false;
    const Ctx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    src.connect(analyser);
    const meterSink = ctx.createGain();
    meterSink.gain.value = 0;
    analyser.connect(meterSink);
    meterSink.connect(ctx.destination);

    const buf = new Float32Array(analyser.fftSize);

    const tick = window.setInterval(() => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Drive meter from the louder of RMS or peak so the bar tracks transients like the REMOTE meter does.
      const target = Math.min(1, Math.max(rms * 2.4, peak * 1.2));
      // Fast attack, slow release (matches remote meter feel).
      const prev = levelRef.current;
      levelRef.current = target > prev ? target : prev * 0.82 + target * 0.18;
      setStats({
        connection: "CONNECTED",
        level: levelRef.current,
        packetsSent: 0,
        packetsFailed: 0,
        packetsDropped: 0,
        sending: true,
        targetUrl: "WebRTC session",
        bridgeHost: "session",
        slot,
        enabled: true,
        lastError: null,
      });
    }, 60);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      try { src.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      try { meterSink.disconnect(); } catch {}
      void ctx.close().catch(() => {});
      levelRef.current = 0;
    };
  }, [stream, slot, enabled]);

  return stats;
}
