/**
 * AudioManager for YAJ Survival Island.
 *
 * Everything is synthesised with WebAudio (no files, nothing to download): a looping
 * ocean/wind bed plus playful one-shots. If recorded audio is added later these are the
 * cues to swap: waves, wind, coconut, crate, warning, star, power, heart, waveStart,
 * timerWarning, victory, failed.
 */

const KEY = "wheuat.survival-island.muted";

let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* storage unavailable */
}

let ctx: AudioContext | null = null;
let bed: { src: AudioBufferSourceNode; gain: GainNode; wind: GainNode } | null = null;

function ac() {
  if (muted) return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function islandMuted() {
  return muted;
}

export function islandSetMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (next) islandAmbienceStop();
}

function tone(freq: number, dur: number, type: OscillatorType = "triangle", gain = 0.07, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), at + dur);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.04);
}

function noise(dur: number, gain = 0.06, hp = 400, delay = 0) {
  const c = ac();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

/** Soft ocean bed: filtered pink-ish noise, gently modulated. */
export function islandAmbienceStart() {
  const c = ac();
  if (!c || bed) return;
  const len = Math.floor(c.sampleRate * 4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 720;
  const gain = c.createGain();
  gain.gain.value = 0.075;
  const wind = c.createGain();
  wind.gain.value = 0;
  const windFilter = c.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 1400;

  src.connect(lp).connect(gain).connect(c.destination);
  src.connect(windFilter).connect(wind).connect(c.destination);

  // slow swell so the waves breathe instead of hissing
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();

  src.start();
  bed = { src, gain, wind };
}

export function islandAmbienceStop() {
  if (!bed) return;
  try {
    bed.src.stop();
  } catch {
    /* already stopped */
  }
  bed = null;
}

/** Fade the wind layer in during gust waves. */
export function islandWindLevel(level: number) {
  if (!bed || !ctx) return;
  bed.wind.gain.setTargetAtTime(Math.max(0, Math.min(0.09, level * 0.09)), ctx.currentTime, 0.4);
}

export const islandSfx = {
  unlock() {
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
  },
  star() {
    tone(1180, 0.09, "square", 0.045, 1560);
  },
  power() {
    tone(660, 0.14, "triangle", 0.06, 1320);
  },
  heart() {
    [523, 659, 880].forEach((f, i) => tone(f, 0.18, "triangle", 0.06, undefined, i * 0.07));
  },
  warn() {
    tone(520, 0.1, "sine", 0.035, 700);
  },
  coconut() {
    noise(0.1, 0.05, 700);
    tone(180, 0.16, "triangle", 0.06, 90);
  },
  crate() {
    noise(0.18, 0.06, 240);
    tone(120, 0.24, "square", 0.055, 70);
  },
  splash() {
    noise(0.4, 0.06, 260);
    tone(320, 0.3, "sine", 0.035, 140);
  },
  wind() {
    noise(0.9, 0.05, 900);
  },
  collapse() {
    noise(0.35, 0.07, 180);
    [200, 150, 110].forEach((f, i) => tone(f, 0.22, "sawtooth", 0.05, undefined, i * 0.08));
  },
  hit() {
    tone(420, 0.32, "sine", 0.08, 150);
  },
  waveStart() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.24, "triangle", 0.06, undefined, i * 0.1));
  },
  objective() {
    [784, 988, 1318].forEach((f, i) => tone(f, 0.2, "square", 0.05, undefined, i * 0.08));
  },
  timerWarning() {
    tone(880, 0.11, "square", 0.045);
  },
  victory() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, undefined, i * 0.11));
  },
  failed() {
    [440, 330, 262].forEach((f, i) => tone(f, 0.32, "sawtooth", 0.06, undefined, i * 0.14));
  },
};
