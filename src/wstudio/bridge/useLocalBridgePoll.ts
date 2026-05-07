import { useEffect, useRef, useState } from "react";

const BRIDGE_URL = "http://127.0.0.1:47999/plugin-audio";
const POLL_MS = 45;
const STALE_MS = 1500; // mark inactive if no samples for this long

export interface LocalBridgeState {
  /** True when at least one recent fetch succeeded (regardless of samples). */
  connected: boolean;
  /** True when the most recent samples payload was non-empty within STALE_MS. */
  feedActive: boolean;
  /** Most recent peak |sample| in [0,1] for visual smoothing. */
  level: number;
  /** Last successful fetch timestamp (ms). */
  lastOkAt: number | null;
  /** Last error message, if any. */
  error: string | null;
}

/**
 * Continuously polls the local desktop bridge (JUCE AU plugin server) for DAW audio.
 * Pure HTTP polling — no WebRTC. CORS expected to be permitted by the local bridge.
 */
export function useLocalBridgePoll(enabled: boolean = true): LocalBridgeState {
  const [state, setState] = useState<LocalBridgeState>({
    connected: false,
    feedActive: false,
    level: 0,
    lastOkAt: null,
    error: null,
  });

  const lastSamplesAt = useRef<number>(0);
  const failureCount = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      let nextDelay = POLL_MS;
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 800);
        const res = await fetch(BRIDGE_URL, { signal: ctrl.signal, cache: "no-store" });
        window.clearTimeout(to);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        failureCount.current = 0;
        const now = performance.now();
        const samples: number[] = Array.isArray(data?.samples) ? data.samples : [];
        let peak = 0;
        if (samples.length > 0) {
          lastSamplesAt.current = now;
          // sample subset for cheap peak
          const step = Math.max(1, Math.floor(samples.length / 256));
          for (let i = 0; i < samples.length; i += step) {
            const v = Math.abs(samples[i] ?? 0);
            if (v > peak) peak = v;
          }
        }
        const stillFresh = now - lastSamplesAt.current < STALE_MS;
        setState((prev) => ({
          connected: true,
          feedActive: samples.length > 0 || stillFresh,
          // smooth level (simple ema)
          level: prev.level * 0.6 + Math.min(1, peak) * 0.4,
          lastOkAt: Date.now(),
          error: null,
        }));
      } catch (err: any) {
        if (cancelled) return;
        failureCount.current += 1;
        // graceful reconnect: backoff to ~500ms after several failures
        nextDelay = failureCount.current > 4 ? 500 : POLL_MS;
        setState((prev) => ({
          connected: false,
          feedActive: false,
          level: prev.level * 0.5,
          lastOkAt: prev.lastOkAt,
          error: err?.name === "AbortError" ? "timeout" : (err?.message ?? "fetch failed"),
        }));
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, nextDelay);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [enabled]);

  return state;
}
