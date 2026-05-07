import { useEffect, useRef } from "react";

/**
 * Captures the local artist mic from a MediaStream and POSTs mono float PCM
 * to the JUCE plugin's local HTTP bridge in small packets.
 *
 *   POST http://127.0.0.1:47999/artist-audio?slot=<slot>
 *   { "samples": [-1..1, ...] }
 *
 * No WebRTC. Plain HTTP. Pairs with the GET /plugin-audio poll the engineer uses.
 */
const BRIDGE_BASE = "http://127.0.0.1:47999/artist-audio";
const PACKET_SAMPLES = 256; // 128–512 range
const MAX_INFLIGHT = 4;

export function useArtistMicBridge(
  stream: MediaStream | null,
  slot: number,
  enabled: boolean = true,
) {
  const announcedRef = useRef(false);
  const inflightRef = useRef(0);
  const lastErrorLogRef = useRef(0);
  const postCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !stream) return;
    const track = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!track) return;

    let cancelled = false;
    const ctx = new AudioContext();
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
      // Detect silence cheaply; still post so the bridge sees liveness, but skip if inflight saturated.
      if (inflightRef.current >= MAX_INFLIGHT) return;

      // Copy to a regular array (JSON-serialisable)
      const samples = new Array(ch.length);
      for (let i = 0; i < ch.length; i++) samples[i] = ch[i];

      if (!announcedRef.current) {
        announcedRef.current = true;
        // eslint-disable-next-line no-console
        console.log("WSTUDIO mic bridge active");
      }

      inflightRef.current++;
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
        keepalive: true,
        cache: "no-store",
      })
        .then(() => {
          postCountRef.current++;
          if (postCountRef.current % 50 === 0) {
            // eslint-disable-next-line no-console
            console.log(`POST artist-audio slot ${slot} samples ${samples.length}`);
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
    };
  }, [stream, slot, enabled]);
}
