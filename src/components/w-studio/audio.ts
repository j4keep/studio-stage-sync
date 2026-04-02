import type { EffectPresetId, EqPresetId, MidiNote, SpacePresetId, Track } from './types';

export function midiNoteToFreq(midi: number): number {
  const m = Math.max(0, Math.min(127, midi));
  return 440 * Math.pow(2, (m - 69) / 12);
}

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
  if (p <= 0.0005) return '−∞';
  const minDb = -56;
  const maxDb = 6;
  const db = minDb + p * (maxDb - minDb);
  if (db <= -55.5) return '−∞';
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
}

export function configureEq(
  low: BiquadFilterNode,
  mid: BiquadFilterNode,
  high: BiquadFilterNode,
  preset: EqPresetId,
  ctx: BaseAudioContext,
) {
  low.type = 'lowshelf';
  mid.type = 'peaking';
  high.type = 'highshelf';
  low.frequency.value = 110;
  mid.frequency.value = 1800;
  mid.Q.value = 1.15;
  high.frequency.value = 8200;
  const nyq = ctx.sampleRate * 0.499;
  const clampF = (f: number) => Math.min(f, nyq * 0.9);

  switch (preset) {
    case 'flat':
      low.gain.value = 0;
      mid.gain.value = 0;
      high.gain.value = 0;
      break;
    case 'warm':
      low.gain.value = 5;
      mid.gain.value = -1.2;
      high.gain.value = -2.5;
      break;
    case 'bright':
      low.gain.value = -1;
      mid.gain.value = 0.5;
      high.gain.value = 4.5;
      break;
    case 'vocal_clarity':
      low.frequency.value = 90;
      low.gain.value = -2.8;
      mid.frequency.value = clampF(2800);
      mid.gain.value = 4.2;
      mid.Q.value = 1.8;
      high.gain.value = 2;
      break;
    case 'bass_boost':
      low.frequency.value = 80;
      low.gain.value = 7;
      mid.gain.value = -0.5;
      high.gain.value = -1;
      break;
    case 'treble_cut':
      low.gain.value = 0.5;
      mid.gain.value = 0;
      high.gain.value = -5.5;
      break;
    case 'mid_scoop':
      low.gain.value = 2;
      mid.gain.value = -4;
      mid.frequency.value = 900;
      mid.Q.value = 0.85;
      high.gain.value = 1.5;
      break;
    case 'air_boost':
      low.gain.value = 0;
      mid.gain.value = -0.5;
      high.frequency.value = 11000;
      high.gain.value = 6;
      break;
    case 'phone_radio':
      low.type = 'highpass';
      low.frequency.value = 450;
      low.Q.value = 0.7;
      mid.type = 'peaking';
      mid.frequency.value = 2200;
      mid.gain.value = 5;
      mid.Q.value = 2;
      high.type = 'lowpass';
      high.frequency.value = 3200;
      high.Q.value = 0.7;
      high.gain.value = 0;
      break;
    case 'vocal_broadcast':
      low.frequency.value = 100;
      low.gain.value = -1.5;
      mid.frequency.value = clampF(3200);
      mid.gain.value = 3.8;
      mid.Q.value = 1.35;
      high.frequency.value = 9500;
      high.gain.value = 2.2;
      break;
    case 'presence_lift':
      low.gain.value = 0;
      mid.frequency.value = clampF(3500);
      mid.gain.value = 4.5;
      mid.Q.value = 1.6;
      high.gain.value = 1.5;
      break;
    case 'de_harsh':
      low.gain.value = 0.5;
      mid.frequency.value = clampF(3100);
      mid.gain.value = -3.5;
      mid.Q.value = 2.2;
      high.gain.value = 0.5;
      break;
    case 'low_cut_vocal':
      low.type = 'highpass';
      low.frequency.value = 85;
      low.Q.value = 0.7;
      mid.frequency.value = clampF(2400);
      mid.gain.value = 1.2;
      mid.Q.value = 1;
      high.gain.value = 0.5;
      break;
    case 'acoustic_guitar':
      low.frequency.value = 120;
      low.gain.value = 1;
      mid.frequency.value = clampF(1200);
      mid.gain.value = -1.8;
      mid.Q.value = 0.9;
      high.frequency.value = 10000;
      high.gain.value = 3.5;
      break;
    case 'electric_guitar':
      low.gain.value = 2;
      mid.frequency.value = clampF(900);
      mid.gain.value = 2.5;
      mid.Q.value = 0.85;
      high.frequency.value = 6500;
      high.gain.value = 1.5;
      break;
    case 'drum_snap':
      low.frequency.value = 70;
      low.gain.value = 3;
      mid.frequency.value = clampF(500);
      mid.gain.value = -2;
      mid.Q.value = 0.75;
      high.frequency.value = 11000;
      high.gain.value = 2.8;
      break;
    case 'exciter_shine':
      low.gain.value = -0.5;
      mid.frequency.value = clampF(2000);
      mid.gain.value = -0.8;
      high.frequency.value = 12000;
      high.gain.value = 7.5;
      break;
    default:
      low.gain.value = 0;
      mid.gain.value = 0;
      high.gain.value = 0;
  }
}

export function configureCompressor(comp: DynamicsCompressorNode, preset: EffectPresetId) {
  switch (preset) {
    case 'none':
      comp.threshold.value = -80;
      comp.knee.value = 40;
      comp.ratio.value = 1;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      break;
    case 'gentle_comp':
      comp.threshold.value = -22;
      comp.knee.value = 18;
      comp.ratio.value = 2.2;
      comp.attack.value = 0.01;
      comp.release.value = 0.22;
      break;
    case 'punch_comp':
      comp.threshold.value = -28;
      comp.knee.value = 6;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      break;
    case 'glue_bus':
      comp.threshold.value = -18;
      comp.knee.value = 26;
      comp.ratio.value = 3;
      comp.attack.value = 0.02;
      comp.release.value = 0.35;
      break;
    case 'limit_soft':
      comp.threshold.value = -10;
      comp.knee.value = 2;
      comp.ratio.value = 12;
      comp.attack.value = 0.002;
      comp.release.value = 0.08;
      break;
    case 'vocal_rider':
      comp.threshold.value = -26;
      comp.knee.value = 22;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.012;
      comp.release.value = 0.28;
      break;
    case 'drum_smash':
      comp.threshold.value = -32;
      comp.knee.value = 4;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.1;
      break;
    case 'bass_sidechainish':
      comp.threshold.value = -20;
      comp.knee.value = 14;
      comp.ratio.value = 4;
      comp.attack.value = 0.025;
      comp.release.value = 0.18;
      break;
    default:
      comp.threshold.value = -80;
      comp.ratio.value = 1;
  }
}

const impulseCache = new Map<string, AudioBuffer>();

function impulseCacheKey(sr: number, preset: SpacePresetId) {
  return `${sr}:${preset}`;
}

/** Short noise-decay IR — not a clone of n-Track’s reverb, but same class of effect */
export function createReverbImpulse(ctx: BaseAudioContext, preset: SpacePresetId): AudioBuffer {
  const sr = ctx.sampleRate;
  let durationSec = 0.45;
  let decay = 3.2;
  if (preset === 'room_small') {
    durationSec = 0.28;
    decay = 4.2;
  } else if (preset === 'hall_med') {
    durationSec = 1.6;
    decay = 2.1;
  } else if (preset === 'plate') {
    durationSec = 0.09;
    decay = 8;
  }
  const len = Math.max(256, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, decay);
      d[i] = (Math.random() * 2 - 1) * env * (0.08 + 0.04 * (1 - t));
    }
  }
  return buf;
}

function getOrCreateImpulse(ctx: BaseAudioContext, preset: SpacePresetId): AudioBuffer | null {
  if (preset === 'off') return null;
  const k = impulseCacheKey(ctx.sampleRate, preset);
  let b = impulseCache.get(k);
  if (!b) {
    b = createReverbImpulse(ctx, preset);
    impulseCache.set(k, b);
  }
  return b;
}

export function configureSpace(
  conv: ConvolverNode,
  revDry: GainNode,
  revWet: GainNode,
  preset: SpacePresetId,
  ctx: BaseAudioContext,
) {
  if (preset === 'off') {
    revDry.gain.value = 1;
    revWet.gain.value = 0;
    return;
  }
  const ir = getOrCreateImpulse(ctx, preset);
  if (ir) conv.buffer = ir;
  if (preset === 'room_small') {
    revDry.gain.value = 0.86;
    revWet.gain.value = 0.34;
  } else if (preset === 'hall_med') {
    revDry.gain.value = 0.78;
    revWet.gain.value = 0.42;
  } else if (preset === 'plate') {
    revDry.gain.value = 0.9;
    revWet.gain.value = 0.28;
  } else {
    revDry.gain.value = 1;
    revWet.gain.value = 0;
  }
}

/** Built-in sounds — categorized in `LIBRARY_BY_CATEGORY` */
export type LibrarySoundId =
  | 'kick'
  | 'kick_room'
  | 'snare'
  | 'clap'
  | 'rim'
  | 'hat_closed'
  | 'hat_open'
  | 'tom_low'
  | 'tom_high'
  | 'cowbell'
  | 'perc_shaker'
  | 'perc_tamb'
  | 'bass_pluck'
  | 'bass_808'
  | 'bass_sub'
  | 'pad_strings'
  | 'keys_epiano'
  | 'keys_organ'
  | 'lead_pluck'
  | 'brass_stab'
  | 'vocal_ahh'
  | 'fx_sweep';

export const EQ_PRESET_LABELS: { id: EqPresetId; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'warm', label: 'Warm' },
  { id: 'bright', label: 'Bright' },
  { id: 'vocal_clarity', label: 'Vocal clarity' },
  { id: 'vocal_broadcast', label: 'Broadcast voice' },
  { id: 'presence_lift', label: 'Presence' },
  { id: 'de_harsh', label: 'De-harsh' },
  { id: 'low_cut_vocal', label: 'Low cut (vocal)' },
  { id: 'bass_boost', label: 'Bass boost' },
  { id: 'treble_cut', label: 'Treble cut' },
  { id: 'mid_scoop', label: 'Mid scoop' },
  { id: 'air_boost', label: 'Air' },
  { id: 'acoustic_guitar', label: 'Acoustic guitar' },
  { id: 'electric_guitar', label: 'Electric guitar' },
  { id: 'drum_snap', label: 'Drum snap' },
  { id: 'exciter_shine', label: 'Exciter / shine' },
  { id: 'phone_radio', label: 'Lo‑fi / radio' },
];

export const EFFECT_PRESET_LABELS: { id: EffectPresetId; label: string }[] = [
  { id: 'none', label: 'Off' },
  { id: 'gentle_comp', label: 'Gentle comp' },
  { id: 'punch_comp', label: 'Punch comp' },
  { id: 'glue_bus', label: 'Glue bus' },
  { id: 'limit_soft', label: 'Soft limit' },
  { id: 'vocal_rider', label: 'Vocal rider' },
  { id: 'drum_smash', label: 'Drum smash' },
  { id: 'bass_sidechainish', label: 'Bass pump' },
];

export const SPACE_PRESET_LABELS: { id: SpacePresetId; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'room_small', label: 'Room' },
  { id: 'hall_med', label: 'Hall' },
  { id: 'plate', label: 'Plate' },
];

export const LIBRARY_BY_CATEGORY: {
  category: string;
  items: { id: LibrarySoundId; name: string }[];
}[] = [
  {
    category: 'Drums — kicks & snares',
    items: [
      { id: 'kick', name: 'Kick (tight)' },
      { id: 'kick_room', name: 'Kick (room)' },
      { id: 'snare', name: 'Snare' },
      { id: 'clap', name: 'Clap' },
      { id: 'rim', name: 'Rim' },
    ],
  },
  {
    category: 'Drums — hats & perc',
    items: [
      { id: 'hat_closed', name: 'Hat closed' },
      { id: 'hat_open', name: 'Hat open' },
      { id: 'tom_low', name: 'Tom low' },
      { id: 'tom_high', name: 'Tom high' },
      { id: 'cowbell', name: 'Cowbell' },
      { id: 'perc_shaker', name: 'Shaker' },
      { id: 'perc_tamb', name: 'Tambourine' },
    ],
  },
  {
    category: 'Bass',
    items: [
      { id: 'bass_pluck', name: 'Pluck' },
      { id: 'bass_808', name: '808 long' },
      { id: 'bass_sub', name: 'Sub drop' },
    ],
  },
  {
    category: 'Keys & pads',
    items: [
      { id: 'keys_epiano', name: 'E‑piano' },
      { id: 'keys_organ', name: 'Organ' },
      { id: 'pad_strings', name: 'String pad' },
      { id: 'lead_pluck', name: 'Lead pluck' },
    ],
  },
  {
    category: 'Vocal & FX',
    items: [
      { id: 'vocal_ahh', name: 'Vocal ahh' },
      { id: 'brass_stab', name: 'Brass stab' },
      { id: 'fx_sweep', name: 'Riser sweep' },
    ],
  },
];

function createLibrarySoundMono(ctx: AudioContext, id: LibrarySoundId): AudioBuffer {
  const sr = ctx.sampleRate;

  const noise = (len: number, amp: number) => {
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * amp;
    return buf;
  };

  switch (id) {
    case 'kick':
    case 'kick_room': {
      const dur = id === 'kick_room' ? 0.55 : 0.4;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const room = id === 'kick_room' ? 0.12 * Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 8) : 0;
        const env = Math.exp(-t * 22);
        const f = 48 + 120 * Math.exp(-t * 28);
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.9 + room;
      }
      return buf;
    }
    case 'snare': {
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
    case 'clap': {
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
    case 'rim': {
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
    case 'hat_closed': {
      const dur = 0.12;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 70);
        const s =
          Math.sin(2 * Math.PI * 8000 * t) * 0.25 + Math.sin(2 * Math.PI * 12000 * t) * 0.12;
        d[i] = (Math.random() * 2 - 1) * env * 0.35 + s * env;
      }
      return buf;
    }
    case 'hat_open': {
      const dur = 0.35;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 7);
        d[i] =
          ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 9000 * t) * 0.15) * env;
      }
      return buf;
    }
    case 'tom_low': {
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
    case 'tom_high': {
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
    case 'cowbell': {
      const dur = 0.22;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 18);
        d[i] =
          (Math.sin(2 * Math.PI * 540 * t) * 0.35 + Math.sin(2 * Math.PI * 800 * t) * 0.25) * env;
      }
      return buf;
    }
    case 'perc_shaker': {
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
    case 'perc_tamb': {
      const dur = 0.4;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 10);
        d[i] =
          (Math.sin(2 * Math.PI * 6200 * t) * 0.2 + (Math.random() * 2 - 1) * 0.2) * env;
      }
      return buf;
    }
    case 'bass_pluck': {
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
    case 'bass_808': {
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
    case 'bass_sub': {
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
    case 'pad_strings': {
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
    case 'keys_epiano': {
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
    case 'keys_organ': {
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
    case 'lead_pluck': {
      const dur = 0.35;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 392;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 9);
        d[i] =
          Math.sin(2 * Math.PI * f * t * (1 + 0.02 * Math.sin(2 * Math.PI * 5 * t))) * env * 0.35;
      }
      return buf;
    }
    case 'brass_stab': {
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
    case 'vocal_ahh': {
      const dur = 1.6;
      const n = Math.floor(dur * sr);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const f = 440;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 3) * Math.exp(-t * 1.1);
        const vib = Math.sin(2 * Math.PI * 5.2 * t) * 0.02;
        d[i] =
          (Math.sin(2 * Math.PI * f * (1 + vib) * t) * 0.22 +
            Math.sin(2 * Math.PI * f * 1.5 * t) * 0.08) *
          env;
      }
      return buf;
    }
    case 'fx_sweep': {
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
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
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

/** One stereo slice from the recorder (L/R same length). */
export type StereoFloatChunk = { L: Float32Array; R: Float32Array };

export function mergeStereoChunks(chunks: StereoFloatChunk[]): StereoFloatChunk {
  let n = 0;
  for (const c of chunks) n += c.L.length;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    L.set(c.L, o);
    R.set(c.R, o);
    o += c.L.length;
  }
  return { L, R };
}

export function audioBufferFromMonoFloat(
  ctx: BaseAudioContext,
  data: Float32Array,
  sampleRate: number,
): AudioBuffer {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.copyToChannel(data as unknown as Float32Array<ArrayBuffer>, 0, 0);
  return buf;
}

/** Duplicate mono to L/R for stereo mixer + pan. */
export function audioBufferToStereo(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  if (buf.numberOfChannels >= 2) return buf;
  const n = buf.length;
  const out = ctx.createBuffer(2, n, buf.sampleRate);
  const m = buf.getChannelData(0);
  out.copyToChannel(m as unknown as Float32Array<ArrayBuffer>, 0, 0);
  out.copyToChannel(m as unknown as Float32Array<ArrayBuffer>, 1, 0);
  return out;
}

export function createLibrarySound(ctx: AudioContext, id: LibrarySoundId): AudioBuffer {
  return audioBufferToStereo(ctx, createLibrarySoundMono(ctx, id));
}

export function audioBufferFromStereoFloat(
  ctx: BaseAudioContext,
  L: Float32Array,
  R: Float32Array,
  sampleRate: number,
): AudioBuffer {
  const len = Math.min(L.length, R.length);
  const buf = ctx.createBuffer(2, len, sampleRate);
  buf.copyToChannel(L.subarray(0, len), 0, 0);
  buf.copyToChannel(R.subarray(0, len), 1, 0);
  return buf;
}

export function getTimelineEndSec(
  tracks: { clips: { startTime: number; buffer: AudioBuffer }[]; midiNotes?: MidiNote[] }[],
  tempoBpm = 120,
): number {
  const spb = 60 / Math.max(40, tempoBpm);
  let end = 8;
  for (const t of tracks) {
    for (const c of t.clips) {
      end = Math.max(end, c.startTime + c.buffer.duration);
    }
    for (const m of t.midiNotes ?? []) {
      end = Math.max(end, m.startBeats * spb + m.durationBeats * spb);
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
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
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
  const revDry = offline.createGain();
  const conv = offline.createConvolver();
  const revWet = offline.createGain();
  const pan = offline.createStereoPanner();
  pan.pan.value = track.pan;
  configureEq(low, mid, high, track.eqPreset, offline);
  configureCompressor(comp, track.effectPreset);
  configureSpace(conv, revDry, revWet, track.spacePreset, offline);
  g.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(comp);
  comp.connect(revDry);
  revDry.connect(pan);
  comp.connect(conv);
  conv.connect(revWet);
  revWet.connect(pan);
  pan.connect(master);
  return g;
}

export async function offlineRenderMix(
  tracks: Track[],
  durationSec: number,
  sampleRate: number,
  tempoBpm = 120,
): Promise<AudioBuffer> {
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

  const spb = 60 / Math.max(40, tempoBpm);

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
    if (!trackAudible(track, soloAny)) continue;
    for (const note of track.midiNotes ?? []) {
      const ns = note.startBeats * spb;
      const ne = ns + note.durationBeats * spb;
      if (ne <= 0 || ns >= durationSec) continue;
      const playFrom = Math.max(0, ns);
      const playEnd = Math.min(ne, durationSec);
      const dur = playEnd - playFrom;
      if (dur <= 0) continue;
      const osc = offline.createOscillator();
      const env = offline.createGain();
      const vel = Math.max(0.08, Math.min(1, note.velocity)) * 0.14;
      osc.type = 'triangle';
      osc.frequency.value = midiNoteToFreq(note.pitch);
      osc.connect(env);
      env.connect(g);
      const t0 = playFrom;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(vel, t0 + 0.01);
      env.gain.setValueAtTime(vel, t0 + Math.max(0.02, dur - 0.03));
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }
  }

  return offline.startRendering();
}
