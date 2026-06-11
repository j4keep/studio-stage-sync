/**
 * Procedural loop generator. Synthesizes short AudioBuffers via OfflineAudioContext
 * for the Soundtrap-style Sound Library so users always have content to drag
 * onto the timeline, even without any uploaded samples.
 */

export type LoopCategory =
  | "drums" | "808" | "hi-hats" | "snare" | "kick" | "clap"
  | "synth" | "bass" | "piano" | "guitar" | "sfx" | "vocal";

export interface LoopDef {
  id: string;
  name: string;
  pack: string;
  category: LoopCategory;
  genre: string;
  bpm: number;
  bars: number;
  key?: string; // root note name e.g. "C2"
  color: string;
}

const SR = 44100;

const noteHz = (semis: number, base = 261.63) => base * Math.pow(2, semis / 12);

const NOTE_NAMES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

function parseNote(n: string): number {
  const m = n.match(/^([A-G][#b]?)(-?\d)$/);
  if (!m) return 0;
  const pc = NOTE_NAMES[m[1]] ?? 0;
  const oct = parseInt(m[2], 10);
  return (oct - 4) * 12 + pc; // semitones from C4 (261.63)
}

const hzFromNote = (n: string) => noteHz(parseNote(n));

// ---------- Voices ----------
function addKick(data: Float32Array, at: number, vel = 1) {
  const len = (SR * 0.35) | 0;
  for (let i = 0; i < len && at + i < data.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 9);
    const pitchEnv = Math.exp(-t * 35) * 80;
    const f = 50 + pitchEnv;
    data[at + i] += Math.sin(2 * Math.PI * f * t) * env * 0.95 * vel;
  }
}

function addSnare(data: Float32Array, at: number, vel = 1) {
  const len = (SR * 0.25) | 0;
  for (let i = 0; i < len && at + i < data.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 18);
    const tone = Math.sin(2 * Math.PI * 200 * t) * 0.35;
    const noise = (Math.random() * 2 - 1) * 0.9;
    data[at + i] += (tone + noise) * env * 0.5 * vel;
  }
}

function addHat(data: Float32Array, at: number, vel = 1, open = false) {
  const len = (SR * (open ? 0.18 : 0.05)) | 0;
  let prev = 0;
  for (let i = 0; i < len && at + i < data.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * (open ? 12 : 60));
    let n = Math.random() * 2 - 1;
    n = n - prev * 0.6; prev = n; // simple HPF
    data[at + i] += n * env * 0.35 * vel;
  }
}

function addClap(data: Float32Array, at: number, vel = 1) {
  for (let burst = 0; burst < 4; burst++) {
    const offset = at + ((burst * 0.012 * SR) | 0);
    const len = (SR * 0.08) | 0;
    for (let i = 0; i < len && offset + i < data.length; i++) {
      const t = i / SR;
      const env = Math.exp(-t * 30);
      const n = Math.random() * 2 - 1;
      data[offset + i] += n * env * 0.4 * vel;
    }
  }
}

function add808(data: Float32Array, at: number, hz: number, durSec: number, vel = 1) {
  const len = (SR * durSec) | 0;
  for (let i = 0; i < len && at + i < data.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 80) * Math.exp(-t * 1.6);
    const drive = Math.tanh(Math.sin(2 * Math.PI * hz * t) * 2.5);
    data[at + i] += drive * env * 0.8 * vel;
  }
}

function addSynthNote(L: Float32Array, R: Float32Array, at: number, hz: number, durSec: number, vel = 1) {
  const len = (SR * durSec) | 0;
  for (let i = 0; i < len && at + i < L.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 30) * Math.exp(-t * 2.2);
    // detuned saw stack
    const s1 = ((2 * (hz * t - Math.floor(hz * t + 0.5))));
    const s2 = ((2 * (hz * 1.005 * t - Math.floor(hz * 1.005 * t + 0.5))));
    const s3 = ((2 * (hz * 0.995 * t - Math.floor(hz * 0.995 * t + 0.5))));
    const v = (s1 + s2 + s3) / 3 * env * 0.22 * vel;
    L[at + i] += v;
    R[at + i] += v * 0.92;
  }
}

function addBassNote(data: Float32Array, at: number, hz: number, durSec: number, vel = 1) {
  const len = (SR * durSec) | 0;
  for (let i = 0; i < len && at + i < data.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 40) * Math.exp(-t * 3.5);
    const v = Math.tanh(Math.sin(2 * Math.PI * hz * t) * 1.8 + Math.sin(2 * Math.PI * hz * 2 * t) * 0.3);
    data[at + i] += v * env * 0.55 * vel;
  }
}

function addPianoNote(L: Float32Array, R: Float32Array, at: number, hz: number, durSec: number, vel = 1) {
  const len = (SR * durSec) | 0;
  for (let i = 0; i < len && at + i < L.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 2.5);
    const v = (
      Math.sin(2 * Math.PI * hz * t) +
      Math.sin(2 * Math.PI * hz * 2 * t) * 0.4 +
      Math.sin(2 * Math.PI * hz * 3 * t) * 0.18
    ) * env * 0.18 * vel;
    L[at + i] += v;
    R[at + i] += v;
  }
}

function addSweep(L: Float32Array, R: Float32Array, at: number, durSec: number) {
  const len = (SR * durSec) | 0;
  let prev = 0;
  for (let i = 0; i < len && at + i < L.length; i++) {
    const t = i / SR;
    const k = t / durSec;
    const cutoff = 1 - Math.exp(-k * 4);
    let n = Math.random() * 2 - 1;
    n = prev + cutoff * (n - prev); prev = n;
    const env = Math.sin(Math.PI * k);
    L[at + i] += n * env * 0.5;
    R[at + i] += n * env * 0.5;
  }
}

// ---------- Loop synth ----------
function renderToBuffer(durSec: number, fill: (L: Float32Array, R: Float32Array) => void): AudioBuffer {
  const frames = (SR * durSec) | 0;
  const buf = new AudioBuffer({ length: frames, numberOfChannels: 2, sampleRate: SR });
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  fill(L, R);
  // Normalize gently
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < frames; i++) { L[i] *= g; R[i] *= g; }
  }
  return buf;
}

export function generateLoop(def: LoopDef): AudioBuffer {
  const beatSec = 60 / def.bpm;
  const stepSec = beatSec / 4; // 16ths
  const totalSec = beatSec * 4 * def.bars;
  const steps = (def.bars * 16) | 0;
  const stepFrame = (s: number) => ((s * stepSec) * SR) | 0;
  const rootHz = def.key ? hzFromNote(def.key) : hzFromNote("C3");

  return renderToBuffer(totalSec, (L, R) => {
    switch (def.category) {
      case "drums": {
        for (let s = 0; s < steps; s++) {
          if (s % 16 === 0 || s % 16 === 8) addKick(L, stepFrame(s));
          if (s % 16 === 4 || s % 16 === 12) addSnare(L, stepFrame(s));
          if (s % 2 === 0) addHat(L, stepFrame(s), 0.7, false);
          if (s % 8 === 6) addHat(L, stepFrame(s), 0.9, true);
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "kick": {
        for (let s = 0; s < steps; s++) {
          if (s % 4 === 0) addKick(L, stepFrame(s));
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "snare": {
        for (let s = 0; s < steps; s++) {
          if (s % 8 === 4) addSnare(L, stepFrame(s));
          if (s % 32 === 30) { addSnare(L, stepFrame(s), 0.7); addSnare(L, stepFrame(s) + (SR * 0.06) | 0, 0.8); }
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "hi-hats": {
        for (let s = 0; s < steps; s++) {
          const vel = 0.5 + ((s % 4 === 0) ? 0.4 : 0) + (Math.random() * 0.2);
          addHat(L, stepFrame(s), vel, s % 16 === 14);
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "clap": {
        for (let s = 0; s < steps; s++) if (s % 8 === 4) addClap(L, stepFrame(s));
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "808": {
        const pattern = [0, -2, 3, -4, 0, 5, -2, 0];
        const noteSteps = 4; // every quarter
        for (let i = 0; i < ((steps / noteSteps) | 0); i++) {
          const semis = pattern[i % pattern.length];
          add808(L, stepFrame(i * noteSteps), rootHz * Math.pow(2, semis / 12), beatSec * 0.95);
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "bass": {
        const pattern = [0, 0, 7, 5, 0, 0, 3, -2];
        for (let i = 0; i < pattern.length * def.bars; i++) {
          addBassNote(L, stepFrame(i * 2), rootHz * Math.pow(2, pattern[i % pattern.length] / 12), stepSec * 1.8);
        }
        for (let i = 0; i < L.length; i++) R[i] = L[i];
        break;
      }
      case "synth": {
        // chord stabs on every beat
        const chord = [0, 4, 7, 11]; // maj7
        for (let b = 0; b < def.bars * 4; b++) {
          for (const semis of chord) {
            addSynthNote(L, R, stepFrame(b * 4), rootHz * 2 * Math.pow(2, semis / 12), beatSec * 0.7);
          }
        }
        break;
      }
      case "piano": {
        const arp = [0, 4, 7, 12, 7, 4];
        for (let i = 0; i < steps / 2; i++) {
          addPianoNote(L, R, stepFrame(i * 2), rootHz * 2 * Math.pow(2, arp[i % arp.length] / 12), stepSec * 2.2);
        }
        break;
      }
      case "guitar": {
        // muted strum pattern
        const chord = [0, 7, 12, 16];
        for (let s = 0; s < steps; s++) {
          if (s % 2 === 0) {
            for (const semis of chord) {
              addPianoNote(L, R, stepFrame(s), rootHz * 2 * Math.pow(2, semis / 12), stepSec * 1.5);
            }
          }
        }
        break;
      }
      case "vocal": {
        // simple AM-modulated sine to suggest a vocal phrase
        for (let s = 0; s < steps; s++) {
          if (s % 16 === 0 || s % 16 === 8) {
            const hz = rootHz * 2 * Math.pow(2, [0, 4, 7, 5][((s / 8) | 0) % 4] / 12);
            addPianoNote(L, R, stepFrame(s), hz, beatSec * 1.6);
          }
        }
        break;
      }
      case "sfx": {
        addSweep(L, R, 0, totalSec);
        break;
      }
    }
  });
}
