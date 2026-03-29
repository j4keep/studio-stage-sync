import type { EffectPresetId, EqPresetId, Track } from "./types";

export function faderToGain(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  if (p <= 0.0005) return 0;
  const minDb = -56;
  const maxDb = 6;
  const db = minDb + p * (maxDb - minDb);
  return Math.pow(10, db / 20);
}

export function faderToDbLabel(t: number): string {
  const p = Math.max(0, Math.min(1, t));
  if (p <= 0.0005) return "−∞";
  const minDb = -56;
  const maxDb = 6;
  const db = minDb + p * (maxDb - minDb);
  if (db <= -55.5) return "−∞";
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

export function configureEq(
  low: BiquadFilterNode,
  mid: BiquadFilterNode,
  high: BiquadFilterNode,
  preset: EqPresetId,
  ctx: BaseAudioContext,
) {
  low.type = "lowshelf";
  mid.type = "peaking";
  high.type = "highshelf";
  low.frequency.value = 110;
  mid.frequency.value = 1800;
  mid.Q.value = 1.15;
  high.frequency.value = 8200;
  const nyq = ctx.sampleRate * 0.499;
  const clampF = (f: number) => Math.min(f, nyq * 0.9);

  switch (preset) {
    case "flat":
      low.gain.value = 0;
      mid.gain.value = 0;
      high.gain.value = 0;
      break;
    case "warm":
      low.gain.value = 5;
      mid.gain.value = -1.2;
      high.gain.value = -2.5;
      break;
    case "bright":
      low.gain.value = -1;
      mid.gain.value = 0.5;
      high.gain.value = 4.5;
      break;
    case "vocal_clarity":
      low.frequency.value = 90;
      low.gain.value = -2.8;
      mid.frequency.value = clampF(2800);
      mid.gain.value = 4.2;
      mid.Q.value = 1.8;
      high.gain.value = 2;
      break;
    case "bass_boost":
      low.frequency.value = 80;
      low.gain.value = 7;
      mid.gain.value = -0.5;
      high.gain.value = -1;
      break;
    case "treble_cut":
      low.gain.value = 0.5;
      mid.gain.value = 0;
      high.gain.value = -5.5;
      break;
    case "mid_scoop":
      low.gain.value = 2;
      mid.gain.value = -4;
      mid.frequency.value = 900;
      mid.Q.value = 0.85;
      high.gain.value = 1.5;
      break;
    case "air_boost":
      low.gain.value = 0;
      mid.gain.value = -0.5;
      high.frequency.value = 11000;
      high.gain.value = 6;
      break;
    case "phone_radio":
      low.type = "highpass";
      low.frequency.value = 450;
      low.Q.value = 0.7;
      mid.type = "peaking";
      mid.frequency.value = 2200;
      mid.gain.value = 5;
      mid.Q.value = 2;
      high.type = "lowpass";
      high.frequency.value = 3200;
      high.Q.value = 0.7;
      high.gain.value = 0;
      break;
    default:
      low.gain.value = 0;
      mid.gain.value = 0;
      high.gain.value = 0;
  }
}

export function configureCompressor(comp: DynamicsCompressorNode, preset: EffectPresetId) {
  switch (preset) {
    case "none":
      comp.threshold.value = -80;
      comp.knee.value = 40;
      comp.ratio.value = 1;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      break;
    case "gentle_comp":
      comp.threshold.value = -22;
      comp.knee.value = 18;
      comp.ratio.value = 2.2;
      comp.attack.value = 0.01;
      comp.release.value = 0.22;
      break;
    case "punch_comp":
      comp.threshold.value = -28;
      comp.knee.value = 6;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      break;
    case "glue_bus":
      comp.threshold.value = -18;
      comp.knee.value = 26;
      comp.ratio.value = 3;
      comp.attack.value = 0.02;
      comp.release.value = 0.35;
      break;
    case "limit_soft":
      comp.threshold.value = -10;
      comp.knee.value = 2;
      comp.ratio.value = 12;
      comp.attack.value = 0.002;
      comp.release.value = 0.08;
      break;
    default:
      comp.threshold.value = -80;
      comp.ratio.value = 1;
  }
}

/** Built-in sounds — categorized in `LIBRARY_BY_CATEGORY` */
export type LibrarySoundId =
  | "kick"
  | "kick_room"
  | "snare"
  | "clap"
  | "rim"
  | "hat_closed"
  | "hat_open"
  | "tom_low"
  | "tom_high"
  | "cowbell"
  | "perc_shaker"
  | "perc_tamb"
  | "bass_pluck"
  | "bass_808"
  | "bass_sub"
  | "pad_strings"
  | "keys_epiano"
  | "keys_organ"
  | "lead_pluck"
  | "brass_stab"
  | "vocal_ahh"
  | "fx_sweep";

export const EQ_PRESET_LABELS: { id: EqPresetId; label: string }[] = [
  { id: "flat", label: "Flat" },
  { id: "warm", label: "Warm" },
  { id: "bright", label: "Bright" },
  { id: "vocal_clarity", label: "Vocal clarity" },
  { id: "bass_boost", label: "Bass boost" },
  { id: "treble_cut", label: "Treble cut" },
  { id: "mid_scoop", label: "Mid scoop" },
  { id: "air_boost", label: "Air" },
  { id: "phone_radio", label: "Lo‑fi / radio" },
];

export const EFFECT_PRESET_LABELS: { id: EffectPresetId; label: string }[] = [
  { id: "none", label: "Off" },
  { id: "gentle_comp", label: "Gentle comp" },
  { id: "punch_comp", label: "Punch comp" },
  { id: "glue_bus", label: "Glue bus" },
  { id: "limit_soft", label: "Soft limit" },
];

export const LIBRARY_BY_CATEGORY: {
  category: string;
  items: { id: LibrarySoundId; name: string }[];
}[] = [
  {
    category: "Drums — kicks & snares",
    items: [
      { id: "kick", name: "Kick (tight)" },
      { id: "kick_room", name: "Kick (room)" },
      { id: "snare", name: "Snare" },
      { id: "clap", name: "Clap" },
      { id: "rim", name: "Rim" },
    ],
  },
  {
    category: "Drums — hats & perc",
    items: [
      { id: "hat_closed", name: "Hat closed" },
      { id: "hat_open", name: "Hat open" },
      { id: "tom_low", name: "Tom low" },
      { id: "tom_high", name: "Tom high" },
      { id: "cowbell", name: "Cowbell" },
      { id: "perc_shaker", name: "Shaker" },
      { id: "perc_tamb", name: "Tambourine" },
    ],
  },
  {
    category: "Bass",
    items: [
      { id: "bass_pluck", name: "Pluck" },
      { id: "bass_808", name: "808 long" },
      { id: "bass_sub", name: "Sub drop" },
    ],
  },
  {
    category: "Keys & pads",
    items: [
      { id: "keys_epiano", name: "E‑piano" },
      { id: "keys_organ", name: "Organ" },
      { id: "pad_strings", name: "String pad" },
      { id: "lead_pluck", name: "Lead pluck" },
    ],
  },
  {
    category: "Vocal & FX",
    items: [
      { id: "vocal_ahh", name: "Vocal ahh" },
      { id: "brass_stab", name: "Brass stab" },
      { id: "fx_sweep", name: "Riser sweep" },
    ],
  },
];

export function createLibrarySound(ctx: AudioContext, id: LibrarySoundId): AudioBuffer {
  const sr = ctx.sampleRate;

  const noise = (len: number, amp: number) => {
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * amp;
    return buf;
  };

  switch (id) {
    case "kick":
    case "kick_room": {
      const dur = id === "kick_room" ? 0.55 : 0.4;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const room = id === "kick_room" ? 0.12 * Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 8) : 0;
        const env = Math.exp(-t * 22);
        const f = 48 + 120 * Math.exp(-t * 28);
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.9 + room;
      }
      return buf;
    }
    case "snare": {
      const dur = 0.25;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const n0 = (Math.random() * 2 - 1) * Math.exp(-t * 35);
        const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 28) * 0.35;
        d[i] = n0 + tone;
      }
      return buf;
    }
    case "clap": {
      const dur = 0.18;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const hits = [0.0008, 0.0035, 0.0068, 0.0095].map((o) => Math.floor(o * sr));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s = 0;
        for (const h of hits) {
          if (i >= h) {
            const tt = (i - h) / sr;
            s += (Math.random() * 2 - 1) * Math.exp(-tt * 120) * 0.35;
          }
        }
        d[i] = s * Math.exp(-t * 14);
      }
      return buf;
    }
    case "rim": {
      const dur = 0.08;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 55) * 0.45;
      }
      return buf;
    }
    case "hat_closed": {
      const dur = 0.12;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 70);
        const s = Math.sin(2 * Math.PI * 8000 * t) * 0.25 + Math.sin(2 * Math.PI * 12000 * t) * 0.12;
        d[i] = (Math.random() * 2 - 1) * env * 0.35 + s * env;
      }
      return buf;
    }
    case "hat_open": {
      const dur = 0.35;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 7);
        d[i] = ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 9000 * t) * 0.15) * env;
      }
      return buf;
    }
    case "tom_low": {
      const dur = 0.45;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f0 = 95;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = f0 * (1 + 2 * Math.exp(-t * 15));
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5) * 0.55;
      }
      return buf;
    }
    case "tom_high": {
      const dur = 0.35;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f0 = 180;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = f0 * (1 + 1.5 * Math.exp(-t * 18));
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8) * 0.5;
      }
      return buf;
    }
    case "cowbell": {
      const dur = 0.22;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 18);
        d[i] = (Math.sin(2 * Math.PI * 540 * t) * 0.35 + Math.sin(2 * Math.PI * 800 * t) * 0.25) * env;
      }
      return buf;
    }
    case "perc_shaker": {
      const dur = 0.6;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const rate = 28;
        const grain = Math.sin(2 * Math.PI * rate * t);
        const env = Math.sin(Math.PI * Math.min(t / dur, 1)) * 0.5;
        d[i] = (Math.random() * 2 - 1) * (0.15 + grain * 0.1) * env;
      }
      return buf;
    }
    case "perc_tamb": {
      const dur = 0.4;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 10);
        d[i] = (Math.sin(2 * Math.PI * 6200 * t) * 0.2 + (Math.random() * 2 - 1) * 0.2) * env;
      }
      return buf;
    }
    case "bass_pluck": {
      const dur = 0.65;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f0 = 65.41;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.8);
        const f = f0 * (1 + 0.4 * Math.exp(-t * 18));
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.55;
      }
      return buf;
    }
    case "bass_808": {
      const dur = 1.4;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.2);
        const f = 41 * Math.exp(-t * 3.5);
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.75;
      }
      return buf;
    }
    case "bass_sub": {
      const dur = 1.1;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 35;
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.8) * 0.7;
      }
      return buf;
    }
    case "pad_strings": {
      const dur = 2.2;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const freqs = [196, 246.94, 293.66];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 2) * Math.exp(-t * 0.35);
        let s = 0;
        for (let k = 0; k < freqs.length; k++) {
          s += Math.sin(2 * Math.PI * freqs[k]! * t + k) * (0.2 / (k + 1));
        }
        d[i] = s * env * 0.45;
      }
      return buf;
    }
    case "keys_epiano": {
      const dur = 0.9;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 261.63;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4);
        d[i] =
          (Math.sin(2 * Math.PI * f * t) * 0.4 +
            Math.sin(2 * Math.PI * f * 2 * t) * 0.08 +
            Math.sin(2 * Math.PI * f * 3 * t) * 0.04) *
          env;
      }
      return buf;
    }
    case "keys_organ": {
      const dur = 1.2;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 196;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 6) * Math.exp(-t * 0.15);
        d[i] =
          (Math.sin(2 * Math.PI * f * t) +
            Math.sin(2 * Math.PI * f * 0.5 * t) * 0.5 +
            Math.sin(2 * Math.PI * f * 2 * t) * 0.25) *
          0.15 *
          env;
      }
      return buf;
    }
    case "lead_pluck": {
      const dur = 0.35;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 392;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 9);
        d[i] = Math.sin(2 * Math.PI * f * t * (1 + 0.02 * Math.sin(2 * Math.PI * 5 * t))) * env * 0.35;
      }
      return buf;
    }
    case "brass_stab": {
      const dur = 0.5;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const freqs = [220, 277.18, 329.63];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 40) * Math.exp(-t * 6);
        let s = 0;
        for (const fq of freqs) s += Math.sin(2 * Math.PI * fq * t);
        d[i] = (s / 3) * env * 0.35;
      }
      return buf;
    }
    case "vocal_ahh": {
      const dur = 1.6;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 440;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 3) * Math.exp(-t * 1.1);
        const vib = Math.sin(2 * Math.PI * 5.2 * t) * 0.02;
        d[i] = (Math.sin(2 * Math.PI * f * (1 + vib) * t) * 0.22 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.08) * env;
      }
      return buf;
    }
    case "fx_sweep": {
      const dur = 2;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const k = t / dur;
        const f = 200 + 8000 * k * k;
        const env = Math.sin(Math.PI * k) * 0.45;
        d[i] = Math.sin(2 * Math.PI * f * t) * env;
      }
      return buf;
    }
    default:
      return noise(Math.floor(0.2 * sr), 0.1);
  }
}

export function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

export function encodeWavMono(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);
  return buffer;
}

export function mergeFloatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const b of chunks) total += b.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const b of chunks) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

export function audioBufferFromMonoFloat(ctx: BaseAudioContext, data: Float32Array, sampleRate: number): AudioBuffer {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.copyToChannel(data, 0, 0);
  return buf;
}

export function getTimelineEndSec(tracks: { clips: { startTime: number; buffer: AudioBuffer }[] }[]): number {
  let end = 8;
  for (const t of tracks) {
    for (const c of t.clips) {
      end = Math.max(end, c.startTime + c.buffer.duration);
    }
  }
  return end;
}

export function anySolo(tracks: { solo: boolean }[]): boolean {
  return tracks.some((t) => t.solo);
}

export function trackAudible(t: { muted: boolean; solo: boolean }, soloAny: boolean): boolean {
  if (t.muted) return false;
  if (soloAny) return t.solo;
  return true;
}

export function encodeWavFromAudioBuffer(buf: AudioBuffer): ArrayBuffer {
  const sampleRate = buf.sampleRate;
  const n = buf.length;
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  const dataSize = n * 4;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < n; i++, off += 4) {
    const sl = Math.max(-1, Math.min(1, l[i]));
    const sr = Math.max(-1, Math.min(1, r[i]));
    view.setInt16(off, sl < 0 ? sl * 0x8000 : sl * 0x7fff, true);
    view.setInt16(off + 2, sr < 0 ? sr * 0x8000 : sr * 0x7fff, true);
  }
  return out;
}

function connectOfflineTrack(
  offline: OfflineAudioContext,
  track: Track,
  master: GainNode,
  soloAny: boolean,
): GainNode | null {
  if (!trackAudible(track, soloAny)) return null;
  const g = offline.createGain();
  g.gain.value = faderToGain(track.volume);
  const low = offline.createBiquadFilter();
  const mid = offline.createBiquadFilter();
  const high = offline.createBiquadFilter();
  const comp = offline.createDynamicsCompressor();
  const pan = offline.createStereoPanner();
  pan.pan.value = track.pan;
  configureEq(low, mid, high, track.eqPreset, offline);
  configureCompressor(comp, track.effectPreset);
  g.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(comp);
  comp.connect(pan);
  pan.connect(master);
  return g;
}

export async function offlineRenderMix(tracks: Track[], durationSec: number, sampleRate: number): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const offline = new OfflineAudioContext(2, length, sampleRate);
  const master = offline.createGain();
  master.gain.value = 1;
  master.connect(offline.destination);
  const soloAny = anySolo(tracks);
  const inputs = new Map<string, GainNode>();

  for (const track of tracks) {
    const g = connectOfflineTrack(offline, track, master, soloAny);
    if (g) inputs.set(track.id, g);
  }

  for (const track of tracks) {
    const g = inputs.get(track.id);
    if (!g) continue;
    for (const clip of track.clips) {
      if (clip.startTime >= durationSec) continue;
      const src = offline.createBufferSource();
      src.buffer = clip.buffer;
      src.connect(g);
      const maxDur = durationSec - clip.startTime;
      const dur = Math.min(clip.buffer.duration, maxDur);
      if (dur <= 0) continue;
      src.start(clip.startTime, 0, dur);
    }
  }

  return offline.startRendering();
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  anySolo,
  audioBufferFromMonoFloat,
  configureCompressor,
  configureEq,
  createLibrarySound,
  encodeWavFromAudioBuffer,
  faderToGain,
  getTimelineEndSec,
  mergeFloatChunks,
  offlineRenderMix,
  trackAudible,
  type LibrarySoundId,
} from "./audio";
import { newTrack, type Clip, type EffectPresetId, type EqPresetId, type Track, type TrackKind } from "./types";

type PlaySession = { t0: number; p0: number };

type TrackNodes = {
  fader: GainNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
};

export const INPUT_SOURCE_OPTIONS = [
  "Built-in microphone",
  "Default input",
  "USB microphone",
  "Line in",
  "Aggregate device",
] as const;

type DawContextValue = {
  tracks: Track[];
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  loopEnabled: boolean;
  setLoopEnabled: (v: boolean) => void;
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  tempo: number;
  setTempo: (bpm: number) => void;
  beatsPerBar: number;
  /** Normalized 0–1 peaks for mixer meters */
  meterPeaks: Record<string, number>;
  status: string;
  addTrackWithKind: (kind: TrackKind) => void;
  removeTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  setTrackInputSource: (id: string, label: string) => void;
  setTrackVolume: (id: string, v: number) => void;
  setTrackPan: (id: string, p: number) => void;
  setTrackEq: (id: string, preset: EqPresetId) => void;
  setTrackEffect: (id: string, preset: EffectPresetId) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  toggleRecordArm: (id: string) => void;
  seek: (t: number) => void;
  rewindToStart: () => void;
  play: () => void;
  stopTransport: () => void;
  startRecord: () => Promise<void>;
  stopRecord: () => void;
  deleteClip: (trackId: string, clipId: string) => void;
  addClipFromBuffer: (trackId: string, buffer: AudioBuffer, startTime?: number) => void;
  addLibraryClip: (trackId: string, preset: LibrarySoundId) => void;
  importAudioFile: (trackId: string, file: File) => Promise<void>;
  exportMixWav: () => Promise<void>;
};

const DawContext = createContext<DawContextValue | null>(null);

function ensureAudioCtx(ref: React.MutableRefObject<AudioContext | null>) {
  if (!ref.current) {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ref.current = new Ctx();
  }
  return ref.current;
}

export function DawProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(() => [
    newTrack("Audio 1", 0, "record_audio"),
    newTrack("Audio 2", 1, "import_audio"),
  ]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beatsPerBar] = useState(4);
  const [meterPeaks, setMeterPeaks] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");

  const loopEnabledRef = useRef(loopEnabled);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const trackNodesRef = useRef(new Map<string, TrackNodes>());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playSessionRef = useRef<PlaySession | null>(null);
  const rafRef = useRef<number>(0);
  const metroIntervalRef = useRef<number>(0);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useEffect(() => {
    if (tracks.length && !selectedTrackId) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [tracks, selectedTrackId]);

  const disposeTrackNodes = useCallback((ctx: AudioContext) => {
    for (const n of trackNodesRef.current.values()) {
      try {
        n.fader.disconnect();
        n.low.disconnect();
        n.mid.disconnect();
        n.high.disconnect();
        n.comp.disconnect();
        n.pan.disconnect();
        n.analyser.disconnect();
      } catch {
        /* ignore */
      }
    }
    trackNodesRef.current.clear();
    masterRef.current = null;
  }, []);

  const ensureMaster = useCallback((ctx: AudioContext) => {
    if (!masterRef.current) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      masterRef.current = g;
    }
    return masterRef.current;
  }, []);

  const ensureTrackNodes = useCallback(
    (ctx: AudioContext, trackId: string) => {
      const master = ensureMaster(ctx);
      let t = trackNodesRef.current.get(trackId);
      if (!t) {
        const fader = ctx.createGain();
        const low = ctx.createBiquadFilter();
        const mid = ctx.createBiquadFilter();
        const high = ctx.createBiquadFilter();
        const comp = ctx.createDynamicsCompressor();
        const pan = ctx.createStereoPanner();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.62;
        fader.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(comp);
        comp.connect(pan);
        pan.connect(analyser);
        analyser.connect(master);
        t = { fader, low, mid, high, comp, pan, analyser };
        trackNodesRef.current.set(trackId, t);
      }
      return t;
    },
    [ensureMaster],
  );

  const syncTrackNodeParams = useCallback(
    (ctx: AudioContext, track: Track, soloAny: boolean) => {
      const nodes = ensureTrackNodes(ctx, track.id);
      const audible = trackAudible(track, soloAny);
      nodes.fader.gain.value = audible ? faderToGain(track.volume) : 0;
      nodes.pan.pan.value = track.pan;
      configureEq(nodes.low, nodes.mid, nodes.high, track.eqPreset, ctx);
      configureCompressor(nodes.comp, track.effectPreset);
    },
    [ensureTrackNodes],
  );

  const schedulePlayback = useCallback(
    (ctx: AudioContext, t0: number, p0: number) => {
      const soloAny = anySolo(tracksRef.current);
      for (const tr of tracksRef.current) {
        syncTrackNodeParams(ctx, tr, soloAny);
        if (!trackAudible(tr, soloAny)) continue;
        const nodes = ensureTrackNodes(ctx, tr.id);
        for (const clip of tr.clips) {
          const clipEnd = clip.startTime + clip.buffer.duration;
          if (clipEnd <= p0) continue;
          const playFrom = Math.max(p0, clip.startTime);
          const offset = playFrom - clip.startTime;
          const duration = clipEnd - playFrom;
          const when = t0 + (playFrom - p0);
          const src = ctx.createBufferSource();
          src.buffer = clip.buffer;
          src.connect(nodes.fader);
          src.start(when, offset, duration);
          activeSourcesRef.current.push(src);
        }
      }
    },
    [ensureTrackNodes, syncTrackNodeParams],
  );

  const stopPlaybackSources = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try {
        s.stop();
        s.disconnect();
      } catch {
        /* ignore */
      }
    }
    activeSourcesRef.current = [];
  }, []);

  const stopPlayheadRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const tickPlayhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const sess = playSessionRef.current;
    if (!ctx || !sess) return;
    const t = sess.p0 + (ctx.currentTime - sess.t0);
    const end = getTimelineEndSec(tracksRef.current);
    if (end > 0.02 && t >= end) {
      if (loopEnabledRef.current) {
        stopPlaybackSources();
        const t0 = ctx.currentTime;
        const p0 = 0;
        playSessionRef.current = { t0, p0 };
        schedulePlayback(ctx, t0, p0);
        setCurrentTime(0);
        setStatus("Loop…");
        rafRef.current = requestAnimationFrame(tickPlayhead);
        return;
      }
      for (const s of activeSourcesRef.current) {
        try {
          s.stop();
          s.disconnect();
        } catch {
          /* ignore */
        }
      }
      activeSourcesRef.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      playSessionRef.current = null;
      setIsPlaying(false);
      setCurrentTime(end);
      setStatus("End of timeline.");
      return;
    }
    setCurrentTime(t);
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [schedulePlayback, stopPlaybackSources]);

  const stopTransport = useCallback(() => {
    if (metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = 0;
    }
    const ctx = audioCtxRef.current;
    const sess = playSessionRef.current;
    if (ctx && sess) {
      const t = sess.p0 + (ctx.currentTime - sess.t0);
      setCurrentTime(Math.max(0, t));
    }
    playSessionRef.current = null;
    stopPlaybackSources();
    stopPlayheadRaf();
    setIsPlaying(false);
  }, [stopPlaybackSources, stopPlayheadRaf]);

  const play = useCallback(async () => {
    if (isRecording) {
      setStatus("Stop recording before play.");
      return;
    }
    const ctx = ensureAudioCtx(audioCtxRef);
    if (ctx.state === "suspended") await ctx.resume();
    stopTransport();

    const t0 = ctx.currentTime;
    const p0 = currentTimeRef.current;
    playSessionRef.current = { t0, p0 };
    schedulePlayback(ctx, t0, p0);

    setIsPlaying(true);
    setStatus("");
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [isRecording, schedulePlayback, stopTransport, tickPlayhead]);

  useEffect(() => {
    if (!isPlaying || !metronomeOn) {
      if (metroIntervalRef.current) {
        clearInterval(metroIntervalRef.current);
        metroIntervalRef.current = 0;
      }
      return;
    }
    const ctx = ensureAudioCtx(audioCtxRef);
    void ctx.resume();
    const tick = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1100;
      g.gain.value = 0.07;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      o.start(now);
      o.stop(now + 0.04);
    };
    const ms = (60 / tempoRef.current) * 1000;
    metroIntervalRef.current = window.setInterval(tick, ms);
    return () => {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = 0;
    };
  }, [isPlaying, metronomeOn]);

  const meterHoldRef = useRef<Record<string, number>>({});
  useEffect(() => {
    let id = 0;
    const sample = () => {
      const out: Record<string, number> = {};
      for (const [tid, nodes] of trackNodesRef.current.entries()) {
        const a = nodes.analyser;
        const buf = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        const prev = meterHoldRef.current[tid] ?? 0;
        const v = Math.max(peak, prev * 0.88);
        meterHoldRef.current[tid] = v;
        out[tid] = v;
      }
      setMeterPeaks(out);
      id = requestAnimationFrame(sample);
    };
    id = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(id);
  }, []);

  const seek = useCallback(
    (t: number) => {
      if (isPlaying) stopTransport();
      setCurrentTime(Math.max(0, t));
    },
    [isPlaying, stopTransport],
  );

  const rewindToStart = useCallback(() => {
    seek(0);
  }, [seek]);

  const micStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Float32Array[]>([]);
  const recordProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recordSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordMuteRef = useRef<GainNode | null>(null);
  const recordStartTimeRef = useRef(0);
  const recordingActiveRef = useRef(false);

  const teardownMicGraph = useCallback(() => {
    recordingActiveRef.current = false;
    try {
      recordProcessorRef.current?.disconnect();
      recordSourceRef.current?.disconnect();
      recordMuteRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    recordProcessorRef.current = null;
    recordSourceRef.current = null;
    recordMuteRef.current = null;
    micStreamRef.current?.getTracks().forEach((x) => x.stop());
    micStreamRef.current = null;
    recordChunksRef.current = [];
  }, []);

  const startRecord = useCallback(async () => {
    if (isRecording) return;
    const armed = tracksRef.current.find((x) => x.recordArm);
    const targetId = armed?.id ?? selectedTrackId ?? tracksRef.current[0]?.id;
    if (!targetId) {
      setStatus("No track to record. Arm a track (R) or select one.");
      return;
    }
    if (isPlaying) stopTransport();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx.state === "suspended") await ctx.resume();

      ensureMaster(ctx);
      recordStartTimeRef.current = currentTimeRef.current;
      recordChunksRef.current = [];

      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;

      proc.onaudioprocess = (e) => {
        if (!recordingActiveRef.current) return;
        const ch0 = e.inputBuffer.getChannelData(0);
        recordChunksRef.current.push(new Float32Array(ch0));
      };

      src.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);

      micStreamRef.current = stream;
      recordSourceRef.current = src;
      recordProcessorRef.current = proc;
      recordMuteRef.current = mute;
      recordingActiveRef.current = true;

      setIsRecording(true);
      setStatus("Recording…");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Mic error: ${msg}`);
    }
  }, [ensureMaster, isPlaying, isRecording, selectedTrackId, stopTransport]);

  const stopRecord = useCallback(() => {
    if (!isRecording) return;
    const ctx = audioCtxRef.current;
    const armed = tracksRef.current.find((x) => x.recordArm);
    const targetId = armed?.id ?? selectedTrackId ?? tracksRef.current[0]?.id;
    const startSec = recordStartTimeRef.current;
    recordingActiveRef.current = false;
    teardownMicGraph();
    setIsRecording(false);

    if (!ctx || !targetId) {
      setStatus("Recording stopped.");
      return;
    }

    const merged = mergeFloatChunks(recordChunksRef.current);
    if (merged.length < 64) {
      setStatus("Take too short — nothing saved.");
      return;
    }

    const buf = audioBufferFromMonoFloat(ctx, merged, ctx.sampleRate);
    const clip: Clip = {
      id: crypto.randomUUID(),
      startTime: startSec,
      buffer: buf,
    };

    setTracks((prev) => prev.map((tr) => (tr.id === targetId ? { ...tr, clips: [...tr.clips, clip] } : tr)));
    const nm = tracksRef.current.find((t) => t.id === targetId)?.name ?? "track";
    setStatus(`Saved clip (${buf.duration.toFixed(2)}s) on ${nm}.`);
  }, [isRecording, selectedTrackId, teardownMicGraph]);

  const addTrackWithKind = useCallback((kind: TrackKind) => {
    setTracks((prev) => [...prev, newTrack("", prev.length, kind)]);
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
    setSelectedTrackId((cur) => (cur === id ? null : cur));
    const nodes = trackNodesRef.current.get(id);
    if (nodes) {
      try {
        nodes.fader.disconnect();
        nodes.low.disconnect();
        nodes.mid.disconnect();
        nodes.high.disconnect();
        nodes.comp.disconnect();
        nodes.pan.disconnect();
        nodes.analyser.disconnect();
      } catch {
        /* ignore */
      }
      trackNodesRef.current.delete(id);
    }
  }, []);

  const renameTrack = useCallback((id: string, name: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const setTrackInputSource = useCallback((id: string, label: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, inputSource: label } : t)));
  }, []);

  const setTrackVolume = useCallback(
    (id: string, v: number) => {
      const vol = Math.max(0, Math.min(1, v));
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, volume: vol } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackPan = useCallback(
    (id: string, p: number) => {
      const pan = Math.max(-1, Math.min(1, p));
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, pan } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackEq = useCallback(
    (id: string, preset: EqPresetId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, eqPreset: preset } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackEffect = useCallback(
    (id: string, preset: EffectPresetId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, effectPreset: preset } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const toggleMute = useCallback(
    (id: string) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t));
        if (ctx) {
          const soloAny = anySolo(next);
          for (const tr of next) syncTrackNodeParams(ctx, tr, soloAny);
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const toggleSolo = useCallback(
    (id: string) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t));
        if (ctx) {
          const soloAny = anySolo(next);
          for (const tr of next) syncTrackNodeParams(ctx, tr, soloAny);
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const toggleRecordArm = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return { ...t, recordArm: false };
        return { ...t, recordArm: !t.recordArm };
      }),
    );
    setSelectedTrackId(id);
  }, []);

  const deleteClip = useCallback((trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t)),
    );
  }, []);

  const addClipFromBuffer = useCallback((trackId: string, buffer: AudioBuffer, startTime?: number) => {
    const at = startTime ?? currentTimeRef.current;
    const clip: Clip = {
      id: crypto.randomUUID(),
      startTime: Math.max(0, at),
      buffer,
    };
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)));
    setStatus(`Added clip (${buffer.duration.toFixed(2)}s) at ${at.toFixed(2)}s.`);
  }, []);

  const addLibraryClip = useCallback(
    (trackId: string, preset: LibrarySoundId) => {
      const ctx = ensureAudioCtx(audioCtxRef);
      void ctx.resume();
      const buf = createLibrarySound(ctx, preset);
      addClipFromBuffer(trackId, buf);
    },
    [addClipFromBuffer],
  );

  const importAudioFile = useCallback(
    async (trackId: string, file: File) => {
      try {
        const ctx = ensureAudioCtx(audioCtxRef);
        await ctx.resume();
        const ab = await file.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab.slice(0));
        addClipFromBuffer(trackId, buf, currentTimeRef.current);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Import failed: ${msg}`);
      }
    },
    [addClipFromBuffer],
  );

  const exportMixWav = useCallback(async () => {
    const list = tracksRef.current;
    const end = getTimelineEndSec(list);
    if (end <= 0.05) {
      setStatus("Nothing to export.");
      return;
    }
    setStatus("Exporting…");
    try {
      const sr = audioCtxRef.current?.sampleRate ?? 48000;
      const rendered = await offlineRenderMix(list, end + 0.1, sr);
      const wav = encodeWavFromAudioBuffer(rendered);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mix-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Mix downloaded.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Export failed: ${msg}`);
    }
  }, []);

  useEffect(
    () => () => {
      stopTransport();
      teardownMicGraph();
      const ctx = audioCtxRef.current;
      if (ctx) {
        disposeTrackNodes(ctx);
        ctx.close().catch(() => {});
      }
    },
    [disposeTrackNodes, stopTransport, teardownMicGraph],
  );

  const value = useMemo<DawContextValue>(
    () => ({
      tracks,
      selectedTrackId,
      setSelectedTrackId,
      currentTime,
      isPlaying,
      isRecording,
      loopEnabled,
      setLoopEnabled,
      metronomeOn,
      setMetronomeOn,
      tempo,
      setTempo,
      beatsPerBar,
      meterPeaks,
      status,
      addTrackWithKind,
      removeTrack,
      renameTrack,
      setTrackInputSource,
      setTrackVolume,
      setTrackPan,
      setTrackEq,
      setTrackEffect,
      toggleMute,
      toggleSolo,
      toggleRecordArm,
      seek,
      rewindToStart,
      play,
      stopTransport,
      startRecord,
      stopRecord,
      deleteClip,
      addClipFromBuffer,
      addLibraryClip,
      importAudioFile,
      exportMixWav,
    }),
    [
      tracks,
      selectedTrackId,
      currentTime,
      isPlaying,
      isRecording,
      loopEnabled,
      metronomeOn,
      tempo,
      beatsPerBar,
      meterPeaks,
      status,
      addTrackWithKind,
      removeTrack,
      renameTrack,
      setTrackInputSource,
      setTrackVolume,
      setTrackPan,
      setTrackEq,
      setTrackEffect,
      toggleMute,
      toggleSolo,
      toggleRecordArm,
      seek,
      rewindToStart,
      play,
      stopTransport,
      startRecord,
      stopRecord,
      deleteClip,
      addClipFromBuffer,
      addLibraryClip,
      importAudioFile,
      exportMixWav,
    ],
  );

  return <DawContext.Provider value={value}>{children}</DawContext.Provider>;
}

export function useDaw() {
  const v = useContext(DawContext);
  if (!v) throw new Error("useDaw must be used inside DawProvider");
  return v;
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackKind } from "./types";
import { EFFECT_PRESET_LABELS, EQ_PRESET_LABELS, LIBRARY_BY_CATEGORY, faderToDbLabel } from "./audio";
import { DawProvider, INPUT_SOURCE_OPTIONS, useDaw } from "./DawContext";
import { WaveformCanvas } from "./WaveformCanvas";

const PX_PER_SEC = 52;

function formatBBT(sec: number, bpm: number, beatsPerBar: number) {
  const beats = sec * (bpm / 60);
  const whole = Math.floor(beats + 1e-9);
  const bar = Math.floor(whole / beatsPerBar) + 1;
  const beat = (whole % beatsPerBar) + 1;
  const tick = Math.min(479, Math.floor((beats % 1) * 480));
  return `${bar}:${beat}:${String(tick).padStart(3, "0")}`;
}

function IconPlay() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

function IconRec() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

function IconRewind() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 18V6l-8.5 6zm10 0V6l-8.5 6z" />
    </svg>
  );
}

function IconLoop({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-[#facc15]" : "text-[#9ca3af]"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M17 3h4v4M3 17v4h4M21 11a8 8 0 0 0-14.12-4.88L3 11M3 13a8 8 0 0 0 14.12 4.88L21 13" />
    </svg>
  );
}

function IconMetronome({ off }: { off: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${off ? "text-[#52525b] line-through decoration-2" : "text-[#d4d4d8]"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 3v18M8 21h8M6 8l6-3 6 3v12H6z" />
    </svg>
  );
}

const MODAL_CELLS: {
  kind: TrackKind;
  label: string;
  hint: string;
  color: string;
}[] = [
  { kind: "record_audio", label: "Record audio", hint: "Mic / line", color: "#60a5fa" },
  { kind: "create_beat", label: "Create a beat", hint: "Pattern + drums", color: "#fb7185" },
  { kind: "instrument", label: "Instrument", hint: "Keys / synth", color: "#f8fafc" },
  { kind: "use_loops", label: "Use loops", hint: "Library", color: "#fb923c" },
  { kind: "import_audio", label: "Import audio file", hint: "WAV / MP3", color: "#4ade80" },
  { kind: "play_drums", label: "Play drums", hint: "Pads", color: "#2dd4bf" },
];

type ClipSelection = { trackId: string; clipId: string } | null;

function StartSongModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (k: TrackKind) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-song-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#2a2a32] bg-[#121214] p-5 shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded p-1 text-[#6b7280] hover:bg-[#1a1a1f] hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 id="start-song-title" className="mb-4 text-center text-lg font-semibold text-white">
          Start your song…
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MODAL_CELLS.map((c) => (
            <button
              key={c.kind}
              type="button"
              className="flex flex-col items-center rounded-xl border border-[#2a2a32] bg-[#18181c] px-3 py-4 text-center transition hover:border-[#404048] hover:bg-[#1f1f24]"
              onClick={() => {
                onPick(c.kind);
                onClose();
              }}
            >
              <span className="mb-2 text-2xl" style={{ color: c.color }} aria-hidden>
                ●
              </span>
              <span className="text-[13px] font-medium text-white">{c.label}</span>
              <span className="mt-0.5 text-[10px] text-[#6b7280]">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MixerStrip({
  trackId,
  peak,
  fileInputTrigger,
}: {
  trackId: string;
  peak: number;
  fileInputTrigger: () => void;
}) {
  const daw = useDaw();
  const tr = daw.tracks.find((t) => t.id === trackId);
  if (!tr) return null;

  return (
    <div
      className="flex w-[108px] shrink-0 flex-col border-r border-[#25252b] bg-[#141416]"
      style={{ borderTopColor: tr.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between border-b border-[#25252b] px-1 py-1">
        <span className="mt-0.5 text-[10px] opacity-70" aria-hidden>
          ♪
        </span>
        <button
          type="button"
          className="rounded px-1 text-[12px] text-[#6b7280] hover:bg-[#2a1a1a] hover:text-red-400"
          title="Remove track"
          onClick={() => daw.removeTrack(tr.id)}
        >
          ×
        </button>
      </div>
      <div
        className="border-b border-[#25252b] px-1.5 py-1"
        style={{ borderBottomColor: tr.color, borderBottomWidth: 2 }}
      >
        <input
          value={tr.name}
          onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
          className="w-full truncate bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-[#52525b]"
          placeholder="Name…"
        />
      </div>
      <select
        value={tr.inputSource}
        onChange={(e) => daw.setTrackInputSource(tr.id, e.target.value)}
        className="mx-1 mt-1 truncate rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-1 text-[9px] text-[#d4d4d8]"
      >
        {INPUT_SOURCE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex justify-center gap-1 px-1">
        <button
          type="button"
          title="Mute"
          onClick={() => daw.toggleMute(tr.id)}
          className={`h-7 w-7 rounded border text-[10px] font-bold ${tr.muted ? "border-[#6b2a2a] bg-[#3f1f1f] text-[#fca5a5]" : "border-[#333] bg-[#1e1e22] text-[#a1a1aa]"}`}
        >
          M
        </button>
        <button
          type="button"
          title="Solo"
          onClick={() => daw.toggleSolo(tr.id)}
          className={`h-7 w-7 rounded border text-[10px] font-bold ${tr.solo ? "border-[#6b5a2a] bg-[#3a3420] text-[#fde047]" : "border-[#333] bg-[#1e1e22] text-[#a1a1aa]"}`}
        >
          S
        </button>
        <button
          type="button"
          title="Record arm"
          onClick={() => daw.toggleRecordArm(tr.id)}
          className={`h-7 w-7 rounded-full border text-[10px] font-bold ${tr.recordArm ? "border-red-500 bg-[#4a1515] text-red-300" : "border-[#444] bg-[#252528] text-[#888]"}`}
        >
          R
        </button>
      </div>
      <div className="mt-2 px-1">
        <div className="mb-0.5 flex justify-between text-[9px] text-[#6b7280]">
          <span>Pan</span>
          <span className="font-mono tabular-nums text-[#9ca3af]">{tr.pan.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={tr.pan}
          onChange={(e) => daw.setTrackPan(tr.id, Number(e.target.value))}
          className="h-1 w-full accent-[#a78bfa]"
        />
      </div>
      <select
        value={tr.eqPreset}
        onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
        className="mx-1 mt-1 rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-0.5 text-[8px] text-[#c4c4c4]"
        title="EQ"
      >
        {EQ_PRESET_LABELS.map((o) => (
          <option key={o.id} value={o.id}>
            EQ: {o.label}
          </option>
        ))}
      </select>
      <select
        value={tr.effectPreset}
        onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
        className="mx-1 mt-0.5 rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-0.5 text-[8px] text-[#c4c4c4]"
        title="Dynamics / effects"
      >
        {EFFECT_PRESET_LABELS.map((o) => (
          <option key={o.id} value={o.id}>
            FX: {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="mx-1 mt-1 rounded border border-[#333] py-0.5 text-[8px] text-[#93c5fd] hover:bg-[#1a1a1f]"
        onClick={fileInputTrigger}
      >
        Import file
      </button>

      <div className="mt-2 flex flex-1 items-stretch justify-center gap-1.5 px-1 pb-2">
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 text-[8px] font-mono leading-tight text-[#52525b]">
          <span>0</span>
          <span>-10</span>
          <span>-20</span>
          <span>-30</span>
          <span>-40</span>
          <span>-∞</span>
        </div>
        <div className="relative flex w-5 flex-col justify-end">
          <div className="relative h-[140px] w-full overflow-hidden rounded-sm bg-[#0a0a0c]">
            <div
              className="absolute bottom-0 left-0 right-0 opacity-90 transition-[height] duration-75"
              style={{
                height: `${Math.min(100, peak * 115)}%`,
                background: `linear-gradient(to top, #16a34a 0%, #eab308 70%, #dc2626 100%)`,
              }}
            />
          </div>
        </div>
        <div className="relative flex h-[148px] w-9 items-center justify-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={tr.volume}
            onChange={(e) => daw.setTrackVolume(tr.id, Number(e.target.value))}
            className="absolute w-[120px] -rotate-90 cursor-pointer accent-[#3b82f6]"
            aria-label="Volume fader"
          />
        </div>
      </div>
      <div className="border-t border-[#25252b] py-1 text-center font-mono text-[9px] tabular-nums text-[#94a3b8]">
        {faderToDbLabel(tr.volume)}
      </div>
    </div>
  );
}

function DawChrome() {
  const daw = useDaw();
  const [editorTab, setEditorTab] = useState<"clip" | "piano">("clip");
  const [selection, setSelection] = useState<ClipSelection>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainView, setMainView] = useState<"arrange" | "mixer">("arrange");
  const fileRef = useRef<HTMLInputElement>(null);
  const importTrackRef = useRef<string>("");

  const end = useMemo(() => {
    if (daw.tracks.length === 0) return 90;
    return Math.max(90, ...daw.tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.buffer.duration)));
  }, [daw.tracks]);

  const widthPx = Math.ceil(end * PX_PER_SEC) + 160;

  const selectedClip =
    selection && daw.tracks.find((t) => t.id === selection.trackId)?.clips.find((c) => c.id === selection.clipId);

  const selectedTrack = daw.selectedTrackId ? daw.tracks.find((t) => t.id === daw.selectedTrackId) : null;

  const targetTrackId = daw.selectedTrackId ?? daw.tracks[0]?.id ?? "";

  const [editorWavWidth, setEditorWavWidth] = useState(880);
  useEffect(() => {
    const w = () => setEditorWavWidth(Math.max(320, window.innerWidth - 360));
    w();
    window.addEventListener("resize", w);
    return () => window.removeEventListener("resize", w);
  }, []);

  const openImport = (trackId: string) => {
    importTrackRef.current = trackId;
    fileRef.current?.click();
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-[#0a0a0c] text-[#e4e4e8]">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const tid = importTrackRef.current || targetTrackId;
          if (f && tid) void daw.importAudioFile(tid, f);
          e.target.value = "";
        }}
      />

      <StartSongModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPick={(kind) => daw.addTrackWithKind(kind)}
      />

      {/* Transport — n-Track style */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#25252b] bg-[#161618] px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Record"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#7f1d1d] bg-[#292020] text-[#f87171] hover:bg-[#3f2020]"
            onClick={() => void daw.startRecord()}
            disabled={daw.isRecording}
          >
            <IconRec />
          </button>
          <button
            type="button"
            title="Play"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#e5e5e5] hover:bg-[#2a2a30] disabled:opacity-40"
            onClick={() => daw.play()}
            disabled={daw.isRecording}
          >
            <IconPlay />
          </button>
          <button
            type="button"
            title="Stop"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#a3a3a3] hover:bg-[#2a2a30] disabled:opacity-40"
            onClick={() => daw.stopTransport()}
            disabled={daw.isRecording}
          >
            <IconStop />
          </button>
          <button
            type="button"
            title="Return to start"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#a3a3a3] hover:bg-[#2a2a30]"
            onClick={() => daw.rewindToStart()}
          >
            <IconRewind />
          </button>
          <button
            type="button"
            title={daw.loopEnabled ? "Loop on" : "Loop off"}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${daw.loopEnabled ? "border-[#854d0e] bg-[#422006]" : "border-[#333] bg-[#222226]"}`}
            onClick={() => daw.setLoopEnabled(!daw.loopEnabled)}
          >
            <IconLoop active={daw.loopEnabled} />
          </button>
        </div>

        <div className="mx-1 hidden h-8 w-px bg-[#333] sm:block" />

        <div className="flex flex-col items-center px-2">
          <span className="text-[9px] uppercase tracking-wider text-[#6b7280]">Bars : beats : ticks</span>
          <span className="font-mono text-[15px] font-medium tabular-nums text-[#93c5fd]">
            {formatBBT(daw.currentTime, daw.tempo, daw.beatsPerBar)}
          </span>
        </div>

        <button
          type="button"
          title={daw.metronomeOn ? "Metronome on" : "Metronome off"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] hover:bg-[#2a2a30]"
          onClick={() => daw.setMetronomeOn(!daw.metronomeOn)}
        >
          <IconMetronome off={!daw.metronomeOn} />
        </button>

        <label className="flex items-center gap-1 text-[10px] text-[#6b7280]">
          BPM
          <input
            type="number"
            min={40}
            max={240}
            value={daw.tempo}
            onChange={(e) => daw.setTempo(Number(e.target.value) || 120)}
            className="w-14 rounded border border-[#333] bg-[#1a1a1c] px-1 py-0.5 font-mono text-[11px] text-white"
          />
        </label>

        <label className="ml-auto flex min-w-[140px] max-w-[200px] flex-1 items-center gap-2 sm:max-w-xs">
          <span className="text-[9px] text-[#6b7280]">Pos</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, end)}
            step={0.01}
            value={Math.min(daw.currentTime, end)}
            onChange={(e) => daw.seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer grow accent-[#4d9fff]"
          />
        </label>

        <div className="flex items-center gap-1 border-l border-[#333] pl-2">
          <button
            type="button"
            className={`rounded px-2 py-2 text-[10px] font-medium uppercase ${mainView === "arrange" ? "bg-[#2a2a32] text-white" : "text-[#888] hover:bg-[#222]"}`}
            onClick={() => setMainView("arrange")}
          >
            Timeline
          </button>
          <button
            type="button"
            className={`rounded px-2 py-2 text-[10px] font-medium uppercase ${mainView === "mixer" ? "bg-[#2a2a32] text-white" : "text-[#888] hover:bg-[#222]"}`}
            onClick={() => setMainView("mixer")}
          >
            Mixer
          </button>
        </div>

        <button
          type="button"
          className="rounded border border-[#31318a] bg-[#252542] px-2 py-2 text-[10px] font-medium text-[#c7d2fe] hover:bg-[#2f2f55]"
          onClick={() => void daw.exportMixWav()}
        >
          Export
        </button>
        <button
          type="button"
          className="rounded border border-[#2a2a32] px-2 py-2 text-[10px] text-[#9ca3af] hover:bg-[#1a1a1e]"
          onClick={() => setModalOpen(true)}
        >
          + Track
        </button>
        <button
          type="button"
          className="rounded border border-[#333] px-2 py-2 text-[10px] text-[#93c5fd]"
          onClick={() => targetTrackId && openImport(targetTrackId)}
          disabled={!targetTrackId}
        >
          Import
        </button>
      </header>

      {mainView === "mixer" ? (
        <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[#101012]">
          {daw.tracks.map((t) => (
            <MixerStrip
              key={t.id}
              trackId={t.id}
              peak={daw.meterPeaks[t.id] ?? 0}
              fileInputTrigger={() => openImport(t.id)}
            />
          ))}
          <div className="min-w-[120px] flex-1 bg-[#0c0c0e]" aria-hidden />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#25252b] bg-[#0e0e10]">
            <div className="border-b border-[#25252b] px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7280]">
              Sound library
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {LIBRARY_BY_CATEGORY.map((grp) => (
                <div key={grp.category} className="mb-3">
                  <div className="mb-1 px-1 text-[10px] text-[#9ca3af]">{grp.category}</div>
                  <ul className="space-y-0.5">
                    {grp.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!targetTrackId}
                          className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-[#1a1a1f] disabled:opacity-40"
                          onClick={() => targetTrackId && daw.addLibraryClip(targetTrackId!, item.id)}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="border-t border-[#25252b] p-2 text-[10px] leading-snug text-[#6b7280]">
              Adds at playhead on the selected track. Use mixer <strong className="text-[#9ca3af]">Import file</strong>{" "}
              for your own audio.
            </p>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0c]">
            <div className="sticky top-0 z-20 flex h-7 shrink-0 items-end border-b border-[#25252b] bg-[#0c0c0f]">
              <div className="w-[188px] shrink-0 border-r border-[#25252b] bg-[#0c0c0f]" />
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div className="relative h-7" style={{ width: widthPx }}>
                  {Array.from({ length: Math.ceil(end / 4) + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute bottom-0 top-0 border-l border-[#1f1f24] pl-1 text-[9px] leading-none text-[#52525b]"
                      style={{ left: i * 4 * PX_PER_SEC }}
                    >
                      <span className="inline-block translate-y-0.5">{i * 4}s</span>
                    </div>
                  ))}
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#4d9fff]"
                    style={{ left: daw.currentTime * PX_PER_SEC, zIndex: 10 }}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {daw.tracks.map((tr) => (
                <div
                  key={tr.id}
                  className={`flex border-b border-[#1a1a1e] ${daw.selectedTrackId === tr.id ? "bg-[#0f141c]" : "bg-[#0a0a0c]"}`}
                >
                  <div className="flex w-[188px] shrink-0 border-r border-[#25252b]">
                    <div className="w-1 shrink-0" style={{ backgroundColor: tr.color }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 py-1.5">
                      <input
                        className="w-full truncate border border-transparent bg-transparent text-[12px] font-medium text-white outline-none focus:border-[#2a2a32]"
                        value={tr.name}
                        onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
                      />
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={`h-6 w-6 rounded text-[10px] font-bold ${tr.muted ? "bg-[#3f1f1f] text-[#fca5a5]" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleMute(tr.id)}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          className={`h-6 w-6 rounded text-[10px] font-bold ${tr.solo ? "bg-[#3a3420] text-[#fde047]" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleSolo(tr.id)}
                        >
                          S
                        </button>
                        <button
                          type="button"
                          className={`h-6 w-6 rounded-full text-[9px] font-bold ${tr.recordArm ? "bg-[#4a1515] text-red-300" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleRecordArm(tr.id)}
                        >
                          R
                        </button>
                        <button
                          type="button"
                          className="ml-auto text-[9px] text-[#6b7280] hover:text-white"
                          onClick={() => daw.setSelectedTrackId(tr.id)}
                        >
                          Select
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-left text-[9px] text-[#6b7280] hover:text-[#a1a1aa]"
                        onClick={() => daw.removeTrack(tr.id)}
                      >
                        Delete track
                      </button>
                    </div>
                  </div>

                  <div className="relative min-h-[56px] min-w-0 flex-1">
                    <div
                      className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-px bg-[#4d9fff]"
                      style={{ left: daw.currentTime * PX_PER_SEC }}
                    />
                    <div className="relative h-full min-h-[56px]" style={{ width: widthPx }}>
                      {tr.clips.map((c) => {
                        const w = Math.max(24, c.buffer.duration * PX_PER_SEC);
                        const h = 48;
                        const isSel = selection?.trackId === tr.id && selection?.clipId === c.id;
                        return (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            className={`group absolute top-1 cursor-pointer overflow-hidden rounded-sm border text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] ${
                              isSel
                                ? "border-[#93c5fd] ring-1 ring-[#60a5fa]/50"
                                : "border-[#2a2a32] hover:border-[#404040]"
                            }`}
                            style={{
                              left: c.startTime * PX_PER_SEC,
                              width: w,
                              height: h,
                              backgroundColor: `${tr.color}22`,
                            }}
                            onClick={() => setSelection({ trackId: tr.id, clipId: c.id })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setSelection({ trackId: tr.id, clipId: c.id });
                            }}
                          >
                            <WaveformCanvas
                              buffer={c.buffer}
                              width={Math.floor(w)}
                              height={h}
                              color={tr.color}
                              fill="rgba(0,0,0,0.35)"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 z-10 hidden rounded-bl bg-black/55 px-1.5 py-0.5 text-[11px] text-white group-hover:inline"
                              aria-label="Remove clip"
                              onClick={(e) => {
                                e.stopPropagation();
                                daw.deleteClip(tr.id, c.id);
                                setSelection((s) => (s?.clipId === c.id && s.trackId === tr.id ? null : s));
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="flex h-[140px] shrink-0 flex-col border-t border-[#25252b] bg-[#101012]">
        <div className="flex border-b border-[#25252b] text-[11px]">
          <button
            type="button"
            className={`px-4 py-1.5 font-medium ${editorTab === "clip" ? "bg-[#1a1a1f] text-white" : "text-[#9ca3af] hover:bg-[#16161a]"}`}
            onClick={() => setEditorTab("clip")}
          >
            Clip / waveform
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 font-medium ${editorTab === "piano" ? "bg-[#1a1a1f] text-white" : "text-[#9ca3af] hover:bg-[#16161a]"}`}
            onClick={() => setEditorTab("piano")}
          >
            Piano roll
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch">
          {editorTab === "clip" && selectedClip && selectedTrack ? (
            <div className="flex flex-1 items-center gap-3 p-3">
              <div className="h-1 w-10 shrink-0 rounded" style={{ backgroundColor: selectedTrack.color }} />
              <div className="min-h-0 flex-1 rounded border border-[#25252b] bg-[#0a0a0c]">
                <WaveformCanvas
                  buffer={selectedClip.buffer}
                  width={Math.min(1200, editorWavWidth)}
                  height={96}
                  color="#e2e8f0"
                  fill="rgba(0,0,0,0.5)"
                />
              </div>
            </div>
          ) : editorTab === "clip" ? (
            <p className="flex flex-1 items-center px-4 text-[12px] text-[#6b7280]">
              Select a clip in the timeline for a zoomed waveform.
            </p>
          ) : (
            <div className="flex flex-1 flex-col p-2">
              <div
                className="flex-1 rounded border border-[#1f1f24] bg-[#0a0a0c]"
                style={{
                  backgroundImage:
                    "linear-gradient(#1a1a1e 1px, transparent 1px), linear-gradient(90deg, #141418 1px, transparent 1px)",
                  backgroundSize: "100% 14px, 32px 100%",
                }}
              />
            </div>
          )}
        </div>
      </footer>

      {daw.status ? (
        <div className="border-t border-[#25252b] bg-[#0e0e10] px-3 py-1.5 text-[11px] text-[#9ca3af]">
          {daw.status}
        </div>
      ) : null}
    </div>
  );
}

export function DawWorkspacePage() {
  return (
    <DawProvider>
      <DawChrome />
    </DawProvider>
  );
}

/**
 * Lovable: copy `types.ts`, `audio.ts`, `DawContext.tsx`, `WaveformCanvas.tsx`, `DawWorkspace.tsx`
 * into e.g. `src/features/daw/`.
 *
 * Route: `import { DawWorkspacePage } from '@/features/daw/DawWorkspace';`
 */
export { DawWorkspacePage } from "./DawWorkspace";
export { DawProvider, useDaw, INPUT_SOURCE_OPTIONS } from "./DawContext";
export { WaveformCanvas } from "./WaveformCanvas";
export type { Track, Clip, TrackKind, EqPresetId, EffectPresetId } from "./types";
export type { LibrarySoundId } from "./audio";
export { LIBRARY_BY_CATEGORY, EQ_PRESET_LABELS, EFFECT_PRESET_LABELS, faderToDbLabel } from "./audio";

export type Clip = {
  id: string;
  startTime: number;
  buffer: AudioBuffer;
};

/** Matches the “Start your song…” style picker */
export type TrackKind = "record_audio" | "create_beat" | "instrument" | "use_loops" | "import_audio" | "play_drums";

/** Per-channel EQ preset (Biquad chain configured in AudioContext) */
export type EqPresetId =
  | "flat"
  | "warm"
  | "bright"
  | "vocal_clarity"
  | "bass_boost"
  | "treble_cut"
  | "mid_scoop"
  | "air_boost"
  | "phone_radio";

/** Simple dynamics / polish — uses DynamicsCompressor */
export type EffectPresetId = "none" | "gentle_comp" | "punch_comp" | "glue_bus" | "limit_soft";

/** Header strip colors — close to classic DAW track colors */
export const TRACK_PALETTE = [
  "#2f7dd0",
  "#d0842d",
  "#2fa84f",
  "#c9a227",
  "#8b5cf6",
  "#d93d3d",
  "#2db8a8",
  "#e0579d",
] as const;

export type Track = {
  id: string;
  name: string;
  /** Hex, e.g. `#2f7dd0` */
  color: string;
  kind: TrackKind;
  /** Shown in mixer input dropdown (UI + future routing) */
  inputSource: string;
  /** Single red “R” arm at a time recommended */
  recordArm: boolean;
  /** 0 = off (≈−∞ dB), 1 ≈ +6 dB on fader scale (see `faderToGain`) */
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eqPreset: EqPresetId;
  effectPreset: EffectPresetId;
  clips: Clip[];
};

const KIND_DEFAULT_NAMES: Record<TrackKind, string> = {
  record_audio: "Audio",
  create_beat: "Beat",
  instrument: "Instrument",
  use_loops: "Loops",
  import_audio: "Import",
  play_drums: "Drums",
};

export function newTrack(name: string, index: number, kind: TrackKind = "record_audio"): Track {
  const label = name || `${KIND_DEFAULT_NAMES[kind]} ${index + 1}`;
  return {
    id: crypto.randomUUID(),
    name: label,
    color: TRACK_PALETTE[index % TRACK_PALETTE.length]!,
    kind,
    inputSource: typeof navigator !== "undefined" ? "Built-in microphone" : "Default input",
    recordArm: false,
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    eqPreset: "flat",
    effectPreset: "none",
    clips: [],
  };
}

import { useEffect, useRef } from "react";

type Props = {
  buffer: AudioBuffer;
  width: number;
  height: number;
  /** Wave line color (e.g. track color or white) */
  color: string;
  /** Region fill behind the wave */
  fill?: string;
};

/**
 * Lightweight peak waveform (min/max per column) — reads channel 0.
 * Matches the “audiowave block” look in desktop DAWs.
 */
export function WaveformCanvas({ buffer, width, height, color, fill = "rgba(0,0,0,0.25)" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || width < 1 || height < 1) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.floor(width * dpr));
    c.height = Math.max(1, Math.floor(height * dpr));
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const mid = height / 2;
    const amp = mid * 0.92;
    const cols = Math.max(1, Math.floor(width));
    const step = Math.max(1, Math.floor(data.length / cols));

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = 0; x < cols; x++) {
      let min = 0;
      let max = 0;
      const start = x * step;
      const end = Math.min(start + step, data.length);
      for (let i = start; i < end; i++) {
        const s = data[i]!;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      ctx.moveTo(x + 0.5, mid - max * amp);
      ctx.lineTo(x + 0.5, mid - min * amp);
    }
    ctx.stroke();
  }, [buffer, width, height, color, fill]);

  return <canvas ref={ref} className="pointer-events-none block" aria-hidden />;
}
