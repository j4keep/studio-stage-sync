import { useEffect, useState } from "react";
import { getActiveHelperTransport, HttpHelperTransport } from "@/wstudio/audio-engine/helper";

/**
 * Polls the W.STUDIO Helper App for the latest artist-audio and
 * plugin-audio sample buffers and computes RMS levels (0..1).
 *
 *   GET http://127.0.0.1:48000/artist-audio?slot=<slot>
 *   GET http://127.0.0.1:48000/plugin-audio
 *
 * Returns zeros when the helper is unreachable or buffers are empty —
 * no fake/animated values. Used by /studio's EngineerRoom so the
 * Artist Input / DAW Return meters reflect real audio activity.
 */
export interface HelperAudioLevels {
  artistLevel: number;
  artistSampleCount: number;
  dawReturnLevel: number;
  dawSampleCount: number;
  helperReachable: boolean;
  lastErrorArtist: string | null;
  lastErrorDaw: string | null;
}

const EMPTY: HelperAudioLevels = {
  artistLevel: 0,
  artistSampleCount: 0,
  dawReturnLevel: 0,
  dawSampleCount: 0,
  helperReachable: false,
  lastErrorArtist: null,
  lastErrorDaw: null,
};

const POLL_MS = 120;
const DEV = import.meta.env.DEV;

interface BufferResponse {
  samples?: number[] | null;
  // helper may use any of these field names
  data?: number[] | null;
  pcm?: number[] | null;
}

function pickSamples(body: BufferResponse | null): number[] {
  if (!body) return [];
  return body.samples ?? body.data ?? body.pcm ?? [];
}

function rms(samples: number[]): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 1.8);
}

export function useHelperAudioLevels(slot = 0, enabled = true): HelperAudioLevels {
  const [state, setState] = useState<HelperAudioLevels>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    const helper = getActiveHelperTransport();
    const base = helper instanceof HttpHelperTransport ? helper.baseUrl : "http://127.0.0.1:48000";
    const artistUrl = `${base}/artist-audio?slot=${slot}`;
    const dawUrl = `${base}/plugin-audio`;

    let cancelled = false;
    let inflightA = false;
    let inflightD = false;
    let lastA = 0;
    let lastD = 0;
    let countA = 0;
    let countD = 0;
    let errA: string | null = null;
    let errD: string | null = null;
    let reachable = false;

    const decay = () => {
      lastA *= 0.7;
      lastD *= 0.7;
      if (lastA < 0.01) lastA = 0;
      if (lastD < 0.01) lastD = 0;
    };

    const pollArtist = async () => {
      if (inflightA) return;
      inflightA = true;
      try {
        const res = await fetch(artistUrl, { method: "GET", cache: "no-store", mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        reachable = true;
        const body = (await res.json().catch(() => null)) as BufferResponse | null;
        const samples = pickSamples(body);
        countA = samples.length;
        const r = rms(samples);
        lastA = Math.max(lastA * 0.4, r); // fast attack, gentle release via decay()
        errA = null;
        if (DEV && samples.length) {
          // eslint-disable-next-line no-console
          console.log("[studio] GET /artist-audio samples=", samples.length, "rms=", r.toFixed(3));
        }
      } catch (e) {
        errA = e instanceof Error ? e.message : String(e);
        reachable = false;
        countA = 0;
      } finally {
        inflightA = false;
      }
    };

    const pollDaw = async () => {
      if (inflightD) return;
      inflightD = true;
      try {
        const res = await fetch(dawUrl, { method: "GET", cache: "no-store", mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json().catch(() => null)) as BufferResponse | null;
        const samples = pickSamples(body);
        countD = samples.length;
        const r = rms(samples);
        lastD = Math.max(lastD * 0.4, r);
        errD = null;
      } catch (e) {
        errD = e instanceof Error ? e.message : String(e);
        countD = 0;
      } finally {
        inflightD = false;
      }
    };

    const tick = window.setInterval(() => {
      if (cancelled) return;
      decay();
      void pollArtist();
      void pollDaw();
      setState({
        artistLevel: lastA,
        artistSampleCount: countA,
        dawReturnLevel: lastD,
        dawSampleCount: countD,
        helperReachable: reachable,
        lastErrorArtist: errA,
        lastErrorDaw: errD,
      });
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [slot, enabled]);

  return state;
}
