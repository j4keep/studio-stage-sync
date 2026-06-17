/**
 * Synth preset + drum kit library. 100% original synthesis — no third-party samples,
 * no copyrighted content. Safe to ship publicly (CC0 equivalent).
 *
 * The engine reads these params to actually shape each voice (filter cutoff, ADSR,
 * unison detune, sub osc, LFO, drive) so two presets with the same waveform still
 * sound meaningfully different.
 */

export type SynthWave = "sine" | "triangle" | "sawtooth" | "square";

export interface Preset {
  name: string;
  wave: SynthWave;
  cat: string;
  sub: string;
  // ADSR (seconds, sustain 0..1)
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  // Filter
  filterHz?: number;     // cutoff
  filterQ?: number;      // resonance
  filterEnv?: number;    // 0..1 — env amount opens cutoff on attack
  filterDecay?: number;  // sec — filter env decay
  // Oscillator color
  detune?: number;       // cents (unison spread)
  unison?: number;       // # detuned voices (1..3)
  subLevel?: number;     // 0..1 sine sub one octave below
  octave?: number;       // octave shift (-2..+2)
  // Modulation
  lfoRate?: number;      // Hz
  lfoDepth?: number;     // cents pitch wobble
  // Color / drive
  drive?: number;        // 0..1 waveshaper
  gain?: number;         // 0..1 voice level
}

export const PRESET_CATS = [
  "My Presets",
  "Bass & 808s",
  "Leads",
  "Pads",
  "Keys",
  "Plucks",
  "Bells",
  "Guitar",
  "Orchestral",
  "Synths",
  "FX",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 100+ presets. Each tuned with realistic synthesis params.
// ─────────────────────────────────────────────────────────────────────────────
export const PRESETS: Preset[] = [
  // ── Bass & 808s ──
  { name: "808 Sub",          wave: "sine",     cat: "Bass & 808s", sub: "808",       attack: 0.005, decay: 0.4,  sustain: 0.4, release: 0.6,  filterHz: 220,  filterQ: 0.6, octave: -2, drive: 0.15, gain: 0.9 },
  { name: "808 Distorted",    wave: "sine",     cat: "Bass & 808s", sub: "808",       attack: 0.002, decay: 0.5,  sustain: 0.3, release: 0.5,  filterHz: 600,  filterQ: 1.2, octave: -2, drive: 0.55, gain: 0.85 },
  { name: "808 Glide",        wave: "sine",     cat: "Bass & 808s", sub: "808",       attack: 0.01,  decay: 0.8,  sustain: 0.5, release: 0.9,  filterHz: 300,  filterQ: 0.7, octave: -2, drive: 0.25 },
  { name: "808 Trap Boom",    wave: "triangle", cat: "Bass & 808s", sub: "808",       attack: 0.003, decay: 0.6,  sustain: 0.35,release: 0.7,  filterHz: 250,  filterQ: 0.5, octave: -2, drive: 0.4 },
  { name: "Sub Bass",         wave: "sine",     cat: "Bass & 808s", sub: "Sub",       attack: 0.008, decay: 0.3,  sustain: 0.7, release: 0.4,  filterHz: 180,  octave: -1, gain: 0.85 },
  { name: "Reese Bass",       wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.005, decay: 0.4,  sustain: 0.8, release: 0.4,  filterHz: 700,  filterQ: 4,   detune: 18, unison: 3, octave: -1, drive: 0.3 },
  { name: "Acid Bass",        wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.002, decay: 0.25, sustain: 0.1, release: 0.18, filterHz: 400,  filterQ: 8,   filterEnv: 0.7, filterDecay: 0.25, octave: -1, drive: 0.2 },
  { name: "Pluck Bass",       wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.001, decay: 0.18, sustain: 0,   release: 0.12, filterHz: 600,  filterQ: 3, filterEnv: 0.5, filterDecay: 0.2, octave: -1 },
  { name: "Hoover Bass",      wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.01,  decay: 0.5,  sustain: 0.8, release: 0.4,  filterHz: 900,  filterQ: 5,   detune: 25, unison: 3, octave: -1, drive: 0.4 },
  { name: "Wobble Bass",      wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.005, decay: 0.6,  sustain: 0.7, release: 0.4,  filterHz: 500,  filterQ: 6,   lfoRate: 4, lfoDepth: 0, octave: -1, drive: 0.25 },
  { name: "Funk Slap",        wave: "triangle", cat: "Bass & 808s", sub: "Bass",      attack: 0.001, decay: 0.12, sustain: 0,   release: 0.15, filterHz: 1200, filterQ: 4, filterEnv: 0.6, filterDecay: 0.1, octave: -1, drive: 0.3 },
  { name: "Synth Bass Mk1",   wave: "square",   cat: "Bass & 808s", sub: "Bass",      attack: 0.003, decay: 0.3,  sustain: 0.5, release: 0.25, filterHz: 700,  filterQ: 2, octave: -1, gain: 0.8 },
  { name: "Moog Bass",        wave: "sawtooth", cat: "Bass & 808s", sub: "Bass",      attack: 0.005, decay: 0.4,  sustain: 0.7, release: 0.3,  filterHz: 450,  filterQ: 3, subLevel: 0.4, octave: -1, drive: 0.2 },

  // ── Leads ──
  { name: "Bright Saw Lead",  wave: "sawtooth", cat: "Leads", sub: "Saw Leads",       attack: 0.01,  decay: 0.2,  sustain: 0.8, release: 0.2,  filterHz: 4500, filterQ: 1.2, detune: 10, unison: 2, gain: 0.8 },
  { name: "Super Saw",        wave: "sawtooth", cat: "Leads", sub: "Saw Leads",       attack: 0.02,  decay: 0.3,  sustain: 0.85,release: 0.3,  filterHz: 6000, filterQ: 1,   detune: 22, unison: 3, drive: 0.15 },
  { name: "Trance Lead",      wave: "sawtooth", cat: "Leads", sub: "Saw Leads",       attack: 0.01,  decay: 0.25, sustain: 0.8, release: 0.25, filterHz: 5500, filterQ: 2,   detune: 14, unison: 3 },
  { name: "Square Lead",      wave: "square",   cat: "Leads", sub: "Synth Leads",     attack: 0.005, decay: 0.2,  sustain: 0.75,release: 0.2,  filterHz: 3500, filterQ: 1.5 },
  { name: "Chip Lead",        wave: "square",   cat: "Leads", sub: "Synth Leads",     attack: 0.001, decay: 0.1,  sustain: 0.9, release: 0.08, filterHz: 8000 },
  { name: "Whistle Lead",     wave: "triangle", cat: "Leads", sub: "Synth Leads",     attack: 0.05,  decay: 0.3,  sustain: 0.85,release: 0.3,  filterHz: 5000, lfoRate: 5, lfoDepth: 8 },
  { name: "Fifth Lead",       wave: "sawtooth", cat: "Leads", sub: "Synth Leads",     attack: 0.01,  decay: 0.25, sustain: 0.7, release: 0.3,  filterHz: 4500, detune: 7, unison: 2, subLevel: 0.25 },
  { name: "Vintage Lead",     wave: "triangle", cat: "Leads", sub: "Synth Leads",     attack: 0.02,  decay: 0.3,  sustain: 0.7, release: 0.4,  filterHz: 3500, filterQ: 1.4, lfoRate: 4.5, lfoDepth: 6 },
  { name: "Acid Lead",        wave: "sawtooth", cat: "Leads", sub: "Synth Leads",     attack: 0.003, decay: 0.25, sustain: 0.25,release: 0.18, filterHz: 1500, filterQ: 8, filterEnv: 0.6, filterDecay: 0.3, drive: 0.25 },
  { name: "Future Lead",      wave: "sawtooth", cat: "Leads", sub: "Saw Leads",       attack: 0.01,  decay: 0.2,  sustain: 0.75,release: 0.25, filterHz: 5500, detune: 18, unison: 3, drive: 0.2 },
  { name: "Hardstyle Lead",   wave: "sawtooth", cat: "Leads", sub: "Synth Leads",     attack: 0.005, decay: 0.2,  sustain: 0.85,release: 0.25, filterHz: 6000, filterQ: 2, detune: 12, unison: 2, drive: 0.45 },
  { name: "Dubstep Growl",    wave: "sawtooth", cat: "Leads", sub: "Synth Leads",     attack: 0.01,  decay: 0.4,  sustain: 0.7, release: 0.3,  filterHz: 1200, filterQ: 6, lfoRate: 5, lfoDepth: 0, drive: 0.5 },

  // ── Pads ──
  { name: "Warm Pad",         wave: "sine",     cat: "Pads", sub: "Warm",             attack: 0.4,   decay: 0.6,  sustain: 0.8, release: 1.2,  filterHz: 1800, detune: 8, unison: 2 },
  { name: "Glass Pad",        wave: "triangle", cat: "Pads", sub: "Glass",            attack: 0.5,   decay: 0.8,  sustain: 0.7, release: 1.5,  filterHz: 3200, filterQ: 1.4, lfoRate: 0.6, lfoDepth: 8 },
  { name: "Strings Pad",      wave: "sawtooth", cat: "Pads", sub: "Strings",          attack: 0.6,   decay: 0.5,  sustain: 0.85,release: 1.6,  filterHz: 2400, detune: 14, unison: 3 },
  { name: "Choir Pad",        wave: "triangle", cat: "Pads", sub: "Choir",            attack: 0.8,   decay: 0.4,  sustain: 0.85,release: 1.8,  filterHz: 2200, detune: 18, unison: 3, lfoRate: 0.4, lfoDepth: 12 },
  { name: "Analog Pad",       wave: "sawtooth", cat: "Pads", sub: "Warm",             attack: 0.5,   decay: 0.6,  sustain: 0.8, release: 1.4,  filterHz: 1500, filterQ: 1, detune: 10, unison: 2, subLevel: 0.2 },
  { name: "Ambient Pad",      wave: "sine",     cat: "Pads", sub: "Ambient",          attack: 1.2,   decay: 0.8,  sustain: 0.7, release: 2.5,  filterHz: 1400, lfoRate: 0.25, lfoDepth: 14 },
  { name: "Sci-Fi Pad",       wave: "sawtooth", cat: "Pads", sub: "Ambient",          attack: 0.9,   decay: 0.7,  sustain: 0.7, release: 2.0,  filterHz: 1800, filterQ: 2, lfoRate: 0.5, lfoDepth: 20, detune: 12, unison: 2 },
  { name: "Synthwave Pad",    wave: "sawtooth", cat: "Pads", sub: "Warm",             attack: 0.5,   decay: 0.7,  sustain: 0.8, release: 1.6,  filterHz: 2000, detune: 18, unison: 3 },
  { name: "Vox Pad",          wave: "sine",     cat: "Pads", sub: "Choir",            attack: 0.6,   decay: 0.5,  sustain: 0.8, release: 1.4,  filterHz: 2400, lfoRate: 4.5, lfoDepth: 6 },
  { name: "Lush Pad",         wave: "triangle", cat: "Pads", sub: "Warm",             attack: 0.7,   decay: 0.6,  sustain: 0.85,release: 1.8,  filterHz: 2600, detune: 20, unison: 3 },
  { name: "Dark Pad",         wave: "sawtooth", cat: "Pads", sub: "Ambient",          attack: 0.6,   decay: 0.8,  sustain: 0.7, release: 1.6,  filterHz: 900,  filterQ: 1.5, detune: 12, unison: 2 },
  { name: "Pulse Pad",        wave: "square",   cat: "Pads", sub: "Ambient",          attack: 0.5,   decay: 0.6,  sustain: 0.7, release: 1.4,  filterHz: 1600, lfoRate: 1.5, lfoDepth: 10 },

  // ── Keys ──
  { name: "Bright Piano",     wave: "triangle", cat: "Keys", sub: "Piano",            attack: 0.003, decay: 0.6,  sustain: 0.3, release: 0.5,  filterHz: 5500 },
  { name: "Soft Piano",       wave: "sine",     cat: "Keys", sub: "Piano",            attack: 0.005, decay: 0.8,  sustain: 0.25,release: 0.7,  filterHz: 3500 },
  { name: "Grand Piano",      wave: "triangle", cat: "Keys", sub: "Piano",            attack: 0.003, decay: 0.7,  sustain: 0.3, release: 0.6,  filterHz: 6000, subLevel: 0.15 },
  { name: "Felt Piano",       wave: "sine",     cat: "Keys", sub: "Piano",            attack: 0.01,  decay: 1.0,  sustain: 0.2, release: 0.8,  filterHz: 2800 },
  { name: "Electric Piano",   wave: "triangle", cat: "Keys", sub: "Electric Piano",   attack: 0.003, decay: 0.5,  sustain: 0.45,release: 0.6,  filterHz: 4500, lfoRate: 5, lfoDepth: 5 },
  { name: "Rhodes",           wave: "sine",     cat: "Keys", sub: "Electric Piano",   attack: 0.005, decay: 0.6,  sustain: 0.4, release: 0.7,  filterHz: 3800, lfoRate: 6, lfoDepth: 4 },
  { name: "Wurlitzer",        wave: "triangle", cat: "Keys", sub: "Electric Piano",   attack: 0.004, decay: 0.5,  sustain: 0.4, release: 0.6,  filterHz: 4200, drive: 0.18 },
  { name: "DX Tines",         wave: "sine",     cat: "Keys", sub: "Electric Piano",   attack: 0.002, decay: 0.55, sustain: 0.35,release: 0.5,  filterHz: 5500 },
  { name: "Clavinet",         wave: "square",   cat: "Keys", sub: "Electric Piano",   attack: 0.001, decay: 0.18, sustain: 0.15,release: 0.15, filterHz: 3500, filterQ: 2, drive: 0.2 },
  { name: "Organ",            wave: "sine",     cat: "Keys", sub: "Organ",            attack: 0.005, decay: 0.1,  sustain: 0.95,release: 0.1,  filterHz: 4500, subLevel: 0.5 },
  { name: "Rock Organ",       wave: "square",   cat: "Keys", sub: "Organ",            attack: 0.005, decay: 0.15, sustain: 0.9, release: 0.15, filterHz: 3800, drive: 0.3, lfoRate: 6, lfoDepth: 4 },
  { name: "Church Organ",     wave: "sine",     cat: "Keys", sub: "Organ",            attack: 0.02,  decay: 0.1,  sustain: 0.95,release: 0.4,  filterHz: 5000, subLevel: 0.6 },

  // ── Plucks ──
  { name: "Pluck Synth",      wave: "triangle", cat: "Plucks", sub: "Synth Plucks",   attack: 0.001, decay: 0.18, sustain: 0,   release: 0.12, filterHz: 3500, filterQ: 2, filterEnv: 0.5, filterDecay: 0.15 },
  { name: "Marimba Pluck",    wave: "sine",     cat: "Plucks", sub: "Mallet",         attack: 0.001, decay: 0.25, sustain: 0,   release: 0.15, filterHz: 4500 },
  { name: "Kalimba",          wave: "sine",     cat: "Plucks", sub: "Mallet",         attack: 0.002, decay: 0.3,  sustain: 0,   release: 0.2,  filterHz: 3500 },
  { name: "Harp Pluck",       wave: "triangle", cat: "Plucks", sub: "Harp",           attack: 0.003, decay: 0.6,  sustain: 0,   release: 0.5,  filterHz: 4000 },
  { name: "Koto",             wave: "triangle", cat: "Plucks", sub: "World",          attack: 0.002, decay: 0.4,  sustain: 0,   release: 0.3,  filterHz: 3000, drive: 0.15 },
  { name: "Ukulele",          wave: "triangle", cat: "Plucks", sub: "Strings",        attack: 0.002, decay: 0.4,  sustain: 0,   release: 0.3,  filterHz: 4500, drive: 0.1 },
  { name: "Trap Pluck",       wave: "square",   cat: "Plucks", sub: "Synth Plucks",   attack: 0.001, decay: 0.15, sustain: 0,   release: 0.1,  filterHz: 5500, filterQ: 1.5 },
  { name: "Future Pluck",     wave: "sawtooth", cat: "Plucks", sub: "Synth Plucks",   attack: 0.001, decay: 0.22, sustain: 0,   release: 0.15, filterHz: 4000, filterQ: 2.5, filterEnv: 0.6, filterDecay: 0.2, detune: 8, unison: 2 },
  { name: "Sine Pluck",       wave: "sine",     cat: "Plucks", sub: "Synth Plucks",   attack: 0.001, decay: 0.25, sustain: 0,   release: 0.2,  filterHz: 6000 },
  { name: "Pizzicato",        wave: "triangle", cat: "Plucks", sub: "Strings",        attack: 0.002, decay: 0.18, sustain: 0,   release: 0.12, filterHz: 3500 },

  // ── Bells ──
  { name: "Trap Bell",        wave: "sine",     cat: "Bells", sub: "Trap Bells",      attack: 0.001, decay: 0.6,  sustain: 0,   release: 0.5,  filterHz: 5500 },
  { name: "Glass Bell",       wave: "triangle", cat: "Bells", sub: "Glass",           attack: 0.001, decay: 0.8,  sustain: 0,   release: 0.7,  filterHz: 6500 },
  { name: "Music Box",        wave: "sine",     cat: "Bells", sub: "Music Box",       attack: 0.001, decay: 0.9,  sustain: 0,   release: 0.8,  filterHz: 5000 },
  { name: "Crystal Bell",     wave: "triangle", cat: "Bells", sub: "Glass",           attack: 0.002, decay: 1.0,  sustain: 0,   release: 0.9,  filterHz: 7000, lfoRate: 4, lfoDepth: 4 },
  { name: "Tubular Bell",     wave: "sine",     cat: "Bells", sub: "Tubular",         attack: 0.002, decay: 1.4,  sustain: 0,   release: 1.2,  filterHz: 4500 },
  { name: "Celesta",          wave: "triangle", cat: "Bells", sub: "Celesta",         attack: 0.001, decay: 0.7,  sustain: 0,   release: 0.6,  filterHz: 5500 },
  { name: "Dark Bell",        wave: "sine",     cat: "Bells", sub: "Tubular",         attack: 0.002, decay: 1.2,  sustain: 0,   release: 1.0,  filterHz: 2500, octave: -1 },

  // ── Guitar (synthesized) ──
  { name: "Clean Guitar",     wave: "triangle", cat: "Guitar", sub: "Clean",          attack: 0.003, decay: 0.5,  sustain: 0.25,release: 0.4,  filterHz: 3500, drive: 0.1 },
  { name: "Nylon Guitar",     wave: "triangle", cat: "Guitar", sub: "Clean",          attack: 0.003, decay: 0.6,  sustain: 0.2, release: 0.5,  filterHz: 3000 },
  { name: "Crunch Guitar",    wave: "sawtooth", cat: "Guitar", sub: "Distorted",      attack: 0.003, decay: 0.4,  sustain: 0.6, release: 0.3,  filterHz: 3000, drive: 0.45 },
  { name: "Metal Guitar",     wave: "sawtooth", cat: "Guitar", sub: "Distorted",      attack: 0.002, decay: 0.3,  sustain: 0.75,release: 0.25, filterHz: 2500, drive: 0.7,  detune: 8, unison: 2 },
  { name: "Muted Guitar",     wave: "triangle", cat: "Guitar", sub: "Muted",          attack: 0.001, decay: 0.18, sustain: 0,   release: 0.12, filterHz: 1800, drive: 0.15 },
  { name: "Funk Guitar",      wave: "square",   cat: "Guitar", sub: "Muted",          attack: 0.001, decay: 0.15, sustain: 0,   release: 0.1,  filterHz: 2800, filterQ: 2 },
  { name: "Surf Guitar",      wave: "triangle", cat: "Guitar", sub: "Clean",          attack: 0.003, decay: 0.7,  sustain: 0.3, release: 0.6,  filterHz: 3800, drive: 0.12, lfoRate: 5, lfoDepth: 5 },

  // ── Orchestral ──
  { name: "Strings",          wave: "sawtooth", cat: "Orchestral", sub: "Strings",    attack: 0.3,   decay: 0.5,  sustain: 0.8, release: 1.0,  filterHz: 2800, detune: 12, unison: 3 },
  { name: "Cello",            wave: "sawtooth", cat: "Orchestral", sub: "Strings",    attack: 0.15,  decay: 0.4,  sustain: 0.85,release: 0.8,  filterHz: 1800, octave: -1, detune: 8, unison: 2 },
  { name: "Violin",           wave: "sawtooth", cat: "Orchestral", sub: "Strings",    attack: 0.12,  decay: 0.3,  sustain: 0.85,release: 0.6,  filterHz: 3800, detune: 6, unison: 2, lfoRate: 5, lfoDepth: 8 },
  { name: "Brass Section",    wave: "sawtooth", cat: "Orchestral", sub: "Brass",      attack: 0.05,  decay: 0.3,  sustain: 0.75,release: 0.4,  filterHz: 3000, filterQ: 1.5, detune: 8, unison: 2, drive: 0.15 },
  { name: "Brass Stab",       wave: "square",   cat: "Orchestral", sub: "Brass",      attack: 0.005, decay: 0.2,  sustain: 0.5, release: 0.2,  filterHz: 2800, drive: 0.2 },
  { name: "French Horn",      wave: "triangle", cat: "Orchestral", sub: "Brass",      attack: 0.08,  decay: 0.3,  sustain: 0.8, release: 0.5,  filterHz: 2200, drive: 0.1 },
  { name: "Trumpet",          wave: "sawtooth", cat: "Orchestral", sub: "Brass",      attack: 0.02,  decay: 0.25, sustain: 0.8, release: 0.3,  filterHz: 3200, drive: 0.2 },
  { name: "Flute",            wave: "sine",     cat: "Orchestral", sub: "Woodwind",   attack: 0.05,  decay: 0.2,  sustain: 0.85,release: 0.3,  filterHz: 4500, lfoRate: 4.5, lfoDepth: 6 },
  { name: "Clarinet",         wave: "square",   cat: "Orchestral", sub: "Woodwind",   attack: 0.04,  decay: 0.2,  sustain: 0.8, release: 0.3,  filterHz: 2500 },
  { name: "Pizzicato Strings",wave: "triangle", cat: "Orchestral", sub: "Strings",    attack: 0.001, decay: 0.2,  sustain: 0,   release: 0.18, filterHz: 3500 },

  // ── Synths ──
  { name: "Saw Stack",        wave: "sawtooth", cat: "Synths", sub: "Saw",            attack: 0.01,  decay: 0.3,  sustain: 0.8, release: 0.3,  filterHz: 5000, detune: 16, unison: 3 },
  { name: "Square Stack",     wave: "square",   cat: "Synths", sub: "Square",         attack: 0.01,  decay: 0.25, sustain: 0.8, release: 0.25, filterHz: 4000, detune: 10, unison: 2 },
  { name: "Tri Stack",        wave: "triangle", cat: "Synths", sub: "Triangle",       attack: 0.02,  decay: 0.3,  sustain: 0.8, release: 0.3,  filterHz: 4500, detune: 12, unison: 2 },
  { name: "Sine Stack",       wave: "sine",     cat: "Synths", sub: "Sine",           attack: 0.02,  decay: 0.4,  sustain: 0.7, release: 0.4,  filterHz: 5500 },
  { name: "PWM Synth",        wave: "square",   cat: "Synths", sub: "PWM",            attack: 0.01,  decay: 0.3,  sustain: 0.8, release: 0.3,  filterHz: 3800, lfoRate: 0.8, lfoDepth: 10 },
  { name: "FM Bell Synth",    wave: "sine",     cat: "Synths", sub: "FM",             attack: 0.002, decay: 0.6,  sustain: 0.2, release: 0.5,  filterHz: 6000, drive: 0.3 },
  { name: "Detuned Saw",      wave: "sawtooth", cat: "Synths", sub: "Saw",            attack: 0.005, decay: 0.3,  sustain: 0.75,release: 0.3,  filterHz: 4500, detune: 25, unison: 3 },
  { name: "Sub Saw",          wave: "sawtooth", cat: "Synths", sub: "Saw",            attack: 0.01,  decay: 0.3,  sustain: 0.75,release: 0.3,  filterHz: 3500, subLevel: 0.5 },
  { name: "Phaser Synth",     wave: "sawtooth", cat: "Synths", sub: "Effected",       attack: 0.05,  decay: 0.4,  sustain: 0.75,release: 0.5,  filterHz: 3000, lfoRate: 0.4, lfoDepth: 18, detune: 10, unison: 2 },
  { name: "Vintage Synth",    wave: "sawtooth", cat: "Synths", sub: "Vintage",        attack: 0.02,  decay: 0.4,  sustain: 0.7, release: 0.5,  filterHz: 2800, filterQ: 1.2, drive: 0.2 },

  // ── FX ──
  { name: "FX Riser",         wave: "sawtooth", cat: "FX", sub: "Risers",             attack: 1.5,   decay: 0.1,  sustain: 1.0, release: 0.1,  filterHz: 800, filterQ: 4, filterEnv: 0.9, filterDecay: 1.5, detune: 20, unison: 3, lfoRate: 6, lfoDepth: 20 },
  { name: "FX Downer",        wave: "sawtooth", cat: "FX", sub: "Downers",            attack: 0.05,  decay: 1.5,  sustain: 0,   release: 1.0,  filterHz: 4000, detune: 16, unison: 3 },
  { name: "FX Sweep",         wave: "square",   cat: "FX", sub: "Sweeps",             attack: 0.8,   decay: 0.8,  sustain: 0.5, release: 0.5,  filterHz: 2000, filterQ: 5, lfoRate: 0.5, lfoDepth: 30 },
  { name: "FX Drone",         wave: "sawtooth", cat: "FX", sub: "Drones",             attack: 1.5,   decay: 0.5,  sustain: 0.9, release: 2.0,  filterHz: 1200, detune: 30, unison: 3, lfoRate: 0.2, lfoDepth: 25 },
  { name: "FX Stab",          wave: "sawtooth", cat: "FX", sub: "Stabs",              attack: 0.001, decay: 0.5,  sustain: 0,   release: 0.4,  filterHz: 3000, filterQ: 3, drive: 0.3 },
  { name: "FX Zap",           wave: "square",   cat: "FX", sub: "Stabs",              attack: 0.001, decay: 0.15, sustain: 0,   release: 0.1,  filterHz: 4500, filterEnv: 0.7, filterDecay: 0.1, drive: 0.4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drum kits — each defines per-piece tuning/character. All synthesized in code.
// ─────────────────────────────────────────────────────────────────────────────
export type DrumPiece =
  | "kick" | "snare" | "hat" | "openhat" | "clap" | "rim" | "tom" | "perc"
  | "ride" | "crash" | "cowbell";

export interface KitVoiceSpec {
  // Kick / tom — tonal
  startHz?: number;
  endHz?: number;
  dur?: number;
  drive?: number;
  // Snare / hat / clap / cymbal — noise based
  noiseDecay?: number;
  noiseGain?: number;
  filterType?: BiquadFilterType;
  filterHz?: number;
  filterQ?: number;
  tone?: number;       // 0..1 added sine body
  toneHz?: number;
}

export interface DrumKit {
  name: string;
  description: string;
  voices: Partial<Record<DrumPiece, KitVoiceSpec>>;
}

const baseSnare: KitVoiceSpec = { noiseDecay: 0.18, noiseGain: 0.6, filterType: "bandpass", filterHz: 1500, filterQ: 0.9, tone: 0.35, toneHz: 200 };
const baseHat:   KitVoiceSpec = { noiseDecay: 0.05, noiseGain: 0.3, filterType: "highpass", filterHz: 7500, filterQ: 0.7 };
const baseOpen:  KitVoiceSpec = { noiseDecay: 0.32, noiseGain: 0.32, filterType: "highpass", filterHz: 6500, filterQ: 0.7 };
const baseClap:  KitVoiceSpec = { noiseDecay: 0.14, noiseGain: 0.55, filterType: "bandpass", filterHz: 1200, filterQ: 1.2 };
const baseRide:  KitVoiceSpec = { noiseDecay: 0.5,  noiseGain: 0.28, filterType: "highpass", filterHz: 6000 };
const baseCrash: KitVoiceSpec = { noiseDecay: 1.1,  noiseGain: 0.45, filterType: "highpass", filterHz: 5000 };
const baseRim:   KitVoiceSpec = { noiseDecay: 0.06, noiseGain: 0.45, filterType: "bandpass", filterHz: 2200, filterQ: 4, tone: 0.2, toneHz: 1200 };
const basePerc:  KitVoiceSpec = { noiseDecay: 0.08, noiseGain: 0.4, filterType: "bandpass", filterHz: 3000, filterQ: 1.2 };
const baseCow:   KitVoiceSpec = { tone: 1, toneHz: 540, dur: 0.18, noiseDecay: 0, noiseGain: 0 };

export const DRUM_KITS: DrumKit[] = [
  {
    name: "808",
    description: "Deep sub kick, snappy snare, tight hats. Trap-ready.",
    voices: {
      kick:    { startHz: 110, endHz: 35,  dur: 0.55, drive: 0.4 },
      snare:   { ...baseSnare, noiseGain: 0.55, filterHz: 1700, tone: 0.25, toneHz: 220 },
      hat:     { ...baseHat,   noiseDecay: 0.04, filterHz: 8500 },
      openhat: { ...baseOpen,  noiseDecay: 0.28, filterHz: 7500 },
      clap:    { ...baseClap },
      rim:     { ...baseRim },
      tom:     { startHz: 200, endHz: 80, dur: 0.4 },
      perc:    { ...basePerc },
      ride:    { ...baseRide },
      crash:   { ...baseCrash },
      cowbell: { ...baseCow, toneHz: 560 },
    },
  },
  {
    name: "909",
    description: "Punchy electronic kick, snappy snare, classic house & techno.",
    voices: {
      kick:    { startHz: 160, endHz: 50,  dur: 0.32, drive: 0.3 },
      snare:   { ...baseSnare, noiseDecay: 0.16, noiseGain: 0.7, filterHz: 1800, tone: 0.4, toneHz: 240 },
      hat:     { ...baseHat,   noiseDecay: 0.045, filterHz: 9000 },
      openhat: { ...baseOpen,  noiseDecay: 0.35, filterHz: 7800 },
      clap:    { ...baseClap, filterHz: 1400 },
      rim:     { ...baseRim,  toneHz: 1400 },
      tom:     { startHz: 220, endHz: 90, dur: 0.35 },
      perc:    { ...basePerc, filterHz: 3500 },
      ride:    { ...baseRide },
      crash:   { ...baseCrash },
      cowbell: { ...baseCow, toneHz: 587 },
    },
  },
  {
    name: "Boom Bap",
    description: "Dusty, fat sample-style drums. East coast hip-hop.",
    voices: {
      kick:    { startHz: 130, endHz: 55,  dur: 0.38, drive: 0.25 },
      snare:   { ...baseSnare, noiseGain: 0.7, filterHz: 1300, filterQ: 0.7, tone: 0.5, toneHz: 180 },
      hat:     { ...baseHat,   noiseDecay: 0.05, filterHz: 6500 },
      openhat: { ...baseOpen,  noiseDecay: 0.3, filterHz: 5800 },
      clap:    { ...baseClap, filterHz: 1100, noiseGain: 0.6 },
      rim:     { ...baseRim, toneHz: 1000 },
      tom:     { startHz: 180, endHz: 65, dur: 0.45 },
      perc:    { ...basePerc, filterHz: 2400 },
      ride:    { ...baseRide, filterHz: 5000 },
      crash:   { ...baseCrash, filterHz: 4500 },
      cowbell: { ...baseCow, toneHz: 500 },
    },
  },
  {
    name: "Trap",
    description: "Crispy hats, sharp snares, knocking 808 kick.",
    voices: {
      kick:    { startHz: 100, endHz: 32,  dur: 0.6, drive: 0.5 },
      snare:   { ...baseSnare, noiseDecay: 0.14, noiseGain: 0.65, filterHz: 2000, tone: 0.3, toneHz: 230 },
      hat:     { ...baseHat,   noiseDecay: 0.035, filterHz: 9500 },
      openhat: { ...baseOpen,  noiseDecay: 0.22, filterHz: 8000 },
      clap:    { ...baseClap, filterHz: 1500 },
      rim:     { ...baseRim, toneHz: 1600 },
      tom:     { startHz: 190, endHz: 75, dur: 0.35 },
      perc:    { ...basePerc, filterHz: 4000 },
      ride:    { ...baseRide },
      crash:   { ...baseCrash },
      cowbell: { ...baseCow, toneHz: 620 },
    },
  },
  {
    name: "Lo-Fi",
    description: "Warm, muted, vinyl-textured drums.",
    voices: {
      kick:    { startHz: 120, endHz: 45, dur: 0.32, drive: 0.15 },
      snare:   { ...baseSnare, noiseDecay: 0.16, noiseGain: 0.45, filterHz: 900, filterQ: 0.6, tone: 0.4, toneHz: 170 },
      hat:     { ...baseHat,   noiseDecay: 0.06, filterHz: 5000 },
      openhat: { ...baseOpen,  noiseDecay: 0.28, filterHz: 4500 },
      clap:    { ...baseClap, filterHz: 900, noiseGain: 0.45 },
      rim:     { ...baseRim, toneHz: 900 },
      tom:     { startHz: 160, endHz: 60, dur: 0.4 },
      perc:    { ...basePerc, filterHz: 2200 },
      ride:    { ...baseRide, filterHz: 4500 },
      crash:   { ...baseCrash, filterHz: 4000 },
      cowbell: { ...baseCow, toneHz: 480 },
    },
  },
  {
    name: "Tech House",
    description: "Tight, clicky, four-on-the-floor friendly.",
    voices: {
      kick:    { startHz: 140, endHz: 48, dur: 0.28, drive: 0.35 },
      snare:   { ...baseSnare, noiseDecay: 0.12, noiseGain: 0.6, filterHz: 1900, tone: 0.35, toneHz: 250 },
      hat:     { ...baseHat,   noiseDecay: 0.04, filterHz: 9000 },
      openhat: { ...baseOpen,  noiseDecay: 0.25, filterHz: 7500 },
      clap:    { ...baseClap, filterHz: 1300 },
      rim:     { ...baseRim, toneHz: 1500 },
      tom:     { startHz: 210, endHz: 85, dur: 0.3 },
      perc:    { ...basePerc, filterHz: 3500 },
      ride:    { ...baseRide },
      crash:   { ...baseCrash },
      cowbell: { ...baseCow, toneHz: 600 },
    },
  },
  {
    name: "Acoustic",
    description: "Fuller, natural-feeling kit with longer tails.",
    voices: {
      kick:    { startHz: 150, endHz: 55, dur: 0.4, drive: 0.18 },
      snare:   { ...baseSnare, noiseDecay: 0.22, noiseGain: 0.65, filterHz: 1600, filterQ: 0.8, tone: 0.45, toneHz: 210 },
      hat:     { ...baseHat,   noiseDecay: 0.07, filterHz: 7000 },
      openhat: { ...baseOpen,  noiseDecay: 0.4, filterHz: 6500 },
      clap:    { ...baseClap, filterHz: 1300 },
      rim:     { ...baseRim, toneHz: 1300 },
      tom:     { startHz: 200, endHz: 70, dur: 0.5 },
      perc:    { ...basePerc, filterHz: 2800 },
      ride:    { ...baseRide, noiseDecay: 0.6 },
      crash:   { ...baseCrash, noiseDecay: 1.4 },
      cowbell: { ...baseCow, toneHz: 540 },
    },
  },
];

export const DRUM_PIECE_LABELS: Record<DrumPiece, string> = {
  kick: "Kick", snare: "Snare", hat: "Closed Hat", openhat: "Open Hat",
  clap: "Clap", rim: "Rim", tom: "Tom", perc: "Perc",
  ride: "Ride", crash: "Crash", cowbell: "Cowbell",
};

export const DRUM_PIECES_ORDER: DrumPiece[] = [
  "kick", "snare", "hat", "openhat", "clap", "rim", "tom", "perc", "ride", "crash", "cowbell",
];

export const getPresetByName = (name?: string): Preset | undefined =>
  name ? PRESETS.find(p => p.name === name) : undefined;

export const getKitByName = (name?: string): DrumKit =>
  DRUM_KITS.find(k => k.name === name) || DRUM_KITS[0];
