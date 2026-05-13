import { useEffect, useRef } from "react";

/**
 * Captures the local artist mic from a MediaStream and POSTs mono float PCM
 * to the JUCE plugin's local HTTP bridge in small packets.
 *
 *   POST http://127.0.0.1:47999/artist-audio?slot=<slot>
 *   { "samples": [-1..1, ...] }
 *
 * No WebRTC. Plain HTTP loopback. Pairs with the GET /plugin-audio poll the engineer uses.
 */
const BRIDGE_BASE = "http://127.0.0.1:47999/artist-audio";
const PACKET_SAMPLES = 256; // ~5.8ms @ 44.1k — within the 128–512 / 10–25ms window
const MAX_INFLIGHT = 8;
const LOG_EVERY = 20; // log roughly every ~120ms of audio

export function useArtistMicBridge(
  stream: MediaStream | null,
  slot: number,
  enabled: boolean = true,
) {
  const announcedRef = useRef(false);
  const inflightRef = useRef(0);
  const lastErrorLogRef = useRef(0);
  const postCountRef = useRef(0);
  const droppedRef = useRef(0);

  useEffect(() => {
    if (!enabled || !stream) return;
    const track = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) return;

    let cancelled = false;
    const Ctx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    // ScriptProcessor is deprecated but works everywhere without a worklet asset.
    const node = ctx.createScriptProcessor(PACKET_SAMPLES, 1, 1);
    const muteSink = ctx.createGain();
    muteSink.gain.value = 0;

    src.connect(node);
    node.connect(muteSink);
    muteSink.connect(ctx.destination);

    const url = `${BRIDGE_BASE}?slot=${slot}`;

    node.onaudioprocess = (ev) => {
      if (cancelled) return;
      const ch = ev.inputBuffer.getChannelData(0);

      if (inflightRef.current >= MAX_INFLIGHT) {
        droppedRef.current++;
        if (droppedRef.current % 50 === 0) {
          // eslint-disable-next-line no-console
          console.warn(`artist-audio bridge backpressure, dropped ${droppedRef.current} packets`);
        }
        return;
      }

      // Copy to a regular array (JSON-serialisable). Always send — even silence —
      // so the bridge sees liveness and downstream meters don't stall.
      const samples = new Array(ch.length);
      for (let i = 0; i < ch.length; i++) samples[i] = ch[i];

      if (!announcedRef.current) {
        announcedRef.current = true;
        // eslint-disable-next-line no-console
        console.log(`WSTUDIO mic bridge active → ${url} (sampleRate ${ctx.sampleRate})`);
      }

      inflightRef.current++;
      const body = JSON.stringify({
        sampleRate: ctx.sampleRate,
        slot,
        samples,
      });
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        cache: "no-store",
        mode: "cors",
      })
        .then(() => {
          postCountRef.current++;
          if (postCountRef.current % LOG_EVERY === 0) {
            // eslint-disable-next-line no-console
            console.log(`POST artist-audio slot ${slot} samples: ${samples.length}`);
          }
        })
        .catch((err) => {
          const now = performance.now();
          if (now - lastErrorLogRef.current > 2000) {
            lastErrorLogRef.current = now;
            // eslint-disable-next-line no-console
            console.warn("artist-audio POST failed", err?.message ?? err);
          }
        })
        .finally(() => {
          inflightRef.current = Math.max(0, inflightRef.current - 1);
        });
    };

    return () => {
      cancelled = true;
      try { node.onaudioprocess = null as any; } catch {}
      try { src.disconnect(); } catch {}
      try { node.disconnect(); } catch {}
      try { muteSink.disconnect(); } catch {}
      void ctx.close().catch(() => {});
      announcedRef.current = false;
      inflightRef.current = 0;
    };
  }, [stream, slot, enabled]);
}
