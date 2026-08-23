/**
 * YAJ Snake Royale sound manager — procedural WebAudio only (no assets to load, so it
 * never stalls the first run). Mirrors the pattern used by the other YAJ Adventures
 * titles (see tower-escape-sfx.ts / survival-island-sfx.ts).
 */

const KEY = "yaj.games.snakeroyale.sfx.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;
let ambience: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function snakeRoyaleSetMuted(next: boolean) {
  muted = next;
  if (master) master.gain.value = next ? 0 : 0.5;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function snakeRoyaleMuted() {
  return muted;
}

function blip(freq: number, dur: number, type: OscillatorType = "square", vol = 0.22, slideTo?: number) {
  const c = ac();
  if (!c || !master || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), c.currentTime + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(c.currentTime + dur + 0.03);
}

function noise(dur: number, vol = 0.2, filterType: BiquadFilterType = "highpass", freq = 400) {
  const c = ac();
  if (!c || !master || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export const snakeRoyaleSfx = {
  unlock: () => ac(),
  /** A nearby den stirs / a snake emerges. */
  hiss: () => noise(0.22, 0.14, "bandpass", 3200),
  /** Snake strike connects. */
  bite: () => {
    blip(180, 0.22, "sawtooth", 0.2, 70);
    noise(0.14, 0.16, "lowpass", 300);
  },
  star: () => {
    blip(880, 0.09, "triangle", 0.16);
    setTimeout(() => blip(1320, 0.11, "triangle", 0.14), 70);
  },
  /** Stepping into croc water. */
  splash: () => noise(0.2, 0.18, "lowpass", 900),
  /** Squelching through mud. */
  mud: () => noise(0.09, 0.08, "lowpass", 220),
  /** Rolling rock impact. */
  rock: () => {
    noise(0.22, 0.2, "lowpass", 500);
    blip(120, 0.2, "square", 0.14, 60);
  },
  /** Falling branch impact. */
  branch: () => {
    blip(300, 0.18, "sawtooth", 0.16, 90);
    noise(0.12, 0.12, "lowpass", 700);
  },
  warn: () => {
    [880, 660].forEach((f, i) => setTimeout(() => blip(f, 0.16, "square", 0.15), i * 160));
  },
  wave: () => {
    [660, 880, 1100].forEach((f, i) => setTimeout(() => blip(f, 0.14, "square", 0.14), i * 80));
  },
  objective: () => {
    [740, 990, 1240, 1560].forEach((f, i) => setTimeout(() => blip(f, 0.1, "triangle", 0.15), i * 60));
  },
  timer: () => blip(520, 0.1, "square", 0.12, 700),
  gameOver: () => {
    [420, 330, 260, 180].forEach((f, i) => setTimeout(() => blip(f, 0.26, "sawtooth", 0.16), i * 130));
  },
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => blip(f, 0.22, "triangle", 0.18), i * 110));
  },
};

/** Ambient jungle bed — insect drone + distant bird calls — so the jungle feels alive
 *  even between hazards. */
export function snakeRoyaleAmbienceStart() {
  const c = ac();
  if (!c || !master || ambience) return;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  gain.gain.exponentialRampToValueAtTime(0.045, c.currentTime + 1.4);
  const osc: OscillatorNode[] = [];
  [220, 330, 440].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? "sawtooth" : "sine";
    o.frequency.value = f;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08 + i * 0.05;
    const lg = c.createGain();
    lg.gain.value = 4 + i * 2;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start();
    const bandpass = c.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = f;
    bandpass.Q.value = 8;
    o.connect(bandpass);
    bandpass.connect(gain);
    o.start();
    osc.push(o, lfo);
  });
  ambience = { osc, gain };
}

export function snakeRoyaleAmbienceStop() {
  if (!ambience || !ctx) return;
  const { osc, gain } = ambience;
  ambience = null;
  try {
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(
      () =>
        osc.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        }),
      500,
    );
  } catch {
    /* ignore */
  }
}
