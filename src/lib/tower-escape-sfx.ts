/**
 * YAJ Tower Escape sound manager — procedural WebAudio only (no assets to load,
 * so it never stalls the first run). Mirrors the pattern used by the other
 * YAJ Adventures titles.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let ambience: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function towerSetMuted(next: boolean) {
  muted = next;
  if (master) master.gain.value = next ? 0 : 0.5;
}

export function towerMuted() {
  return muted;
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.22,
  slideTo?: number,
) {
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

function noise(dur: number, vol = 0.2, hp = 400) {
  const c = ac();
  if (!c || !master || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export const towerSfx = {
  unlock: () => ac(),
  jump: () => blip(430, 0.16, "square", 0.16, 720),
  land: () => noise(0.08, 0.12, 900),
  star: () => {
    blip(880, 0.09, "triangle", 0.16);
    setTimeout(() => blip(1320, 0.11, "triangle", 0.14), 70);
  },
  bonus: () => {
    [740, 990, 1240, 1560].forEach((f, i) => setTimeout(() => blip(f, 0.1, "triangle", 0.15), i * 60));
  },
  power: () => {
    [520, 700, 940].forEach((f, i) => setTimeout(() => blip(f, 0.12, "sawtooth", 0.13), i * 55));
  },
  hit: () => {
    blip(180, 0.24, "sawtooth", 0.2, 70);
    noise(0.14, 0.16, 300);
  },
  fall: () => blip(400, 0.4, "sine", 0.18, 90),
  collapse: () => noise(0.3, 0.18, 200),
  checkpoint: () => {
    [660, 880, 1100].forEach((f, i) => setTimeout(() => blip(f, 0.14, "square", 0.14), i * 80));
  },
  warn: () => {
    [880, 660].forEach((f, i) => setTimeout(() => blip(f, 0.18, "square", 0.16), i * 180));
  },
  finish: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.22, "triangle", 0.18), i * 110));
  },
  failed: () => {
    [420, 330, 260, 180].forEach((f, i) => setTimeout(() => blip(f, 0.26, "sawtooth", 0.16), i * 130));
  },
};

/** Low wind/hum bed so the tower feels tall and alive. */
export function towerAmbienceStart() {
  const c = ac();
  if (!c || !master || ambience) return;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  gain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.4);
  const osc: OscillatorNode[] = [];
  [55, 82.5, 110].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i === 2 ? "triangle" : "sine";
    o.frequency.value = f;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06 + i * 0.03;
    const lg = c.createGain();
    lg.gain.value = 2.5;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start();
    o.connect(gain);
    o.start();
    osc.push(o, lfo);
  });
  ambience = { osc, gain };
}

export function towerAmbienceStop() {
  if (!ambience || !ctx) return;
  const { osc, gain } = ambience;
  ambience = null;
  try {
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(() => osc.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 500);
  } catch {
    /* ignore */
  }
}
