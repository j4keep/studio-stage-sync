/**
 * AudioManager for YAJ Neighborhood Adventure.
 *
 * Same shape as Survival Island's sfx module (src/lib/survival-island-sfx.ts): everything is
 * synthesised with WebAudio, no media files. The ambience bed here is a soft daytime-block
 * texture (gentle breeze + a light rhythmic "bird chirp" pattern) instead of ocean/wind — subtle
 * on purpose, never a loud repeating loop.
 */

const KEY = "wheuat.neighborhood.muted";

let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* storage unavailable */
}

let ctx: AudioContext | null = null;
let bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let birdTimer: number | null = null;

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

export function neighborhoodMuted() {
  return muted;
}

export function neighborhoodSetMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (next) neighborhoodAmbienceStop();
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

function birdChirp() {
  const c = ac();
  if (!c || muted) return;
  const base = 2200 + Math.random() * 900;
  tone(base, 0.07, "sine", 0.02, base * 1.3);
  if (Math.random() < 0.5) tone(base * 0.9, 0.06, "sine", 0.016, base * 1.15, 0.09);
}

/** Soft daytime block bed: gentle filtered-noise breeze + occasional distant bird chirps and a
 *  faint low traffic hum. Deliberately quiet — this plays under conversation and exploring. */
export function neighborhoodAmbienceStart() {
  const c = ac();
  if (!c || bed) return;
  const len = Math.floor(c.sampleRate * 4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.015 * white) / 1.015;
    data[i] = last * 2.6;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 480;
  const gain = c.createGain();
  gain.gain.value = 0.035;

  src.connect(bp).connect(gain).connect(c.destination);
  src.start();
  bed = { src, gain };

  const scheduleBird = () => {
    birdChirp();
    birdTimer = window.setTimeout(scheduleBird, 2600 + Math.random() * 3400);
  };
  birdTimer = window.setTimeout(scheduleBird, 1200 + Math.random() * 1800);
}

export function neighborhoodAmbienceStop() {
  if (birdTimer !== null) {
    window.clearTimeout(birdTimer);
    birdTimer = null;
  }
  if (!bed) return;
  try {
    bed.src.stop();
  } catch {
    /* already stopped */
  }
  bed = null;
}

export const neighborhoodSfx = {
  unlock() {
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
  },
  walkStep() {
    noise(0.04, 0.018, 900);
  },
  missionAccepted() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.055, undefined, i * 0.08));
  },
  missionCompleted() {
    [523, 659, 880, 1046].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, undefined, i * 0.09));
  },
  star() {
    tone(1180, 0.09, "square", 0.045, 1560);
  },
  itemPickup() {
    tone(700, 0.1, "square", 0.05, 980);
  },
  npcInteract() {
    tone(560, 0.08, "sine", 0.04, 720);
  },
  locationDiscovery() {
    [660, 880, 1108].forEach((f, i) => tone(f, 0.2, "sine", 0.05, undefined, i * 0.1));
  },
  completion() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, undefined, i * 0.1));
  },
};
