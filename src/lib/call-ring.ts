/** Phone-style ringing tones for in-app calls (WebAudio — no asset files). */

type Ringer = { stop: () => void };

let active: Ringer | null = null;

function ctx(): AudioContext | null {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  const c: AudioContext = ((window as any).__yajRingCtx ||= new AC());
  if (c.state === "suspended") void c.resume().catch(() => {});
  return c;
}

/** Classic double-beep ring pattern; `incoming` is louder/longer than ringback. */
function startPattern(incoming: boolean): Ringer {
  const c = ctx();
  if (!c) return { stop: () => {} };

  const master = c.createGain();
  master.gain.value = incoming ? 0.22 : 0.12;
  master.connect(c.destination);

  let stopped = false;
  let timer = 0;

  const beep = (start: number, dur: number, freq: number) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(1, start + 0.03);
    g.gain.setValueAtTime(1, start + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  const cycle = () => {
    if (stopped) return;
    const t = c.currentTime + 0.02;
    if (incoming) {
      beep(t, 0.4, 440);
      beep(t + 0.5, 0.4, 480);
    } else {
      beep(t, 1.0, 425);
    }
    timer = window.setTimeout(cycle, incoming ? 3000 : 4000);
  };
  cycle();

  return {
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      try {
        master.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}

export function startRing(kind: "incoming" | "outgoing") {
  stopRing();
  active = startPattern(kind === "incoming");
  if (kind === "incoming" && "vibrate" in navigator) {
    try {
      (navigator as any).vibrate?.([500, 1000, 500, 1000, 500, 1000]);
    } catch {
      /* ignore */
    }
  }
}

export function stopRing() {
  active?.stop();
  active = null;
  if ("vibrate" in navigator) {
    try {
      (navigator as any).vibrate?.(0);
    } catch {
      /* ignore */
    }
  }
}
