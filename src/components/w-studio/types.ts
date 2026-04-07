/** For project save/load — clips from library/remote can be rebuilt */
export type ClipSourceMeta =
  | { type: 'library'; soundId: string }
  | { type: 'remote'; remoteId: string };

export type Clip = {
  id: string;
  startTime: number;
  buffer: AudioBuffer;
  /** Optional label in the lane */
  name?: string;
  /** Trim: seconds into buffer where audible region starts (default 0) */
  trimStart?: number;
  /** Trim: seconds into buffer where region ends (default buffer.duration) */
  trimEnd?: number;
  /** Per-clip gain multiplier (applied before track fader) */
  clipGain?: number;
  /** Normalized peak envelope for bar waveform UI */
  waveformPeaks?: number[];
  sourceMeta?: ClipSourceMeta;
};

export function clipTrimStart(c: Clip): number {
  return Math.max(0, c.trimStart ?? 0);
}

export function clipTrimEnd(c: Clip): number {
  const d = c.buffer.duration;
  return Math.min(d, c.trimEnd ?? d);
}

export function clipVisibleDuration(c: Clip): number {
  return Math.max(0.001, clipTrimEnd(c) - clipTrimStart(c));
}

export function clipTimelineEnd(c: Clip): number {
  return c.startTime + clipVisibleDuration(c);
}

/** Piano-roll note; times in quarter-note beats (480 ticks = 1 beat if you scale later) */
export type MidiNote = {
  id: string;
  pitch: number;
  startBeats: number;
  durationBeats: number;
  velocity: number;
};

/** Matches the "Start your song…" style picker */
export type TrackKind =
  | 'record_audio'
  | 'create_beat'
  | 'instrument'
  | 'use_loops'
  | 'import_audio'
  | 'play_drums';

/**
 * High-level studio track role (BandLab-style). Complements `TrackKind` creation flows.
 * Audio graph still keys off clips + MIDI + existing mixer chain.
 */
export type StudioTrackType = 'audio' | 'vocal' | 'instrument' | 'beat' | 'loop';

/** Placeholder FX insert slots per track — plugins wired later. */
export type FxInsertSlot = {
  id: string;
  pluginId: string | null;
  bypass: boolean;
};

export const DEFAULT_FX_INSERT_SLOT_COUNT = 4 as const;

export function createDefaultFxInsertSlots(): FxInsertSlot[] {
  return Array.from({ length: DEFAULT_FX_INSERT_SLOT_COUNT }, (_, i) => ({
    id: `fx-${i}`,
    pluginId: null,
    bypass: false,
  }));
}

export function studioTrackTypeFromKind(kind: TrackKind): StudioTrackType {
  switch (kind) {
    case 'record_audio':
      return 'vocal';
    case 'import_audio':
      return 'audio';
    case 'create_beat':
    case 'play_drums':
      return 'beat';
    case 'instrument':
      return 'instrument';
    case 'use_loops':
      return 'loop';
  }
}

/** Metering + capture width hint: mixer dual meters use `channelConfig.trackShowsStereoMeters`. */
export type TrackChannelMode = 'mono' | 'stereo' | 'auto';

export function defaultChannelModeForKind(kind: TrackKind): TrackChannelMode {
  return kind === 'record_audio' ? 'mono' : 'auto';
}

/** Per-channel EQ preset (Biquad chain configured in AudioContext) */
export type EqPresetId =
  | 'flat'
  | 'warm'
  | 'bright'
  | 'vocal_clarity'
  | 'vocal_broadcast'
  | 'bass_boost'
  | 'treble_cut'
  | 'mid_scoop'
  | 'air_boost'
  | 'phone_radio'
  | 'presence_lift'
  | 'de_harsh'
  | 'low_cut_vocal'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'drum_snap'
  | 'exciter_shine';

/** Simple dynamics / polish — uses DynamicsCompressor */
export type EffectPresetId =
  | 'none'
  | 'gentle_comp'
  | 'punch_comp'
  | 'glue_bus'
  | 'limit_soft'
  | 'vocal_rider'
  | 'drum_smash'
  | 'bass_sidechainish';

/** Post-compressor space (convolver + dry/wet), n-Track-style reverb flavours */
export type SpacePresetId = 'off' | 'room_small' | 'hall_med' | 'plate';

/** Header strip colors — close to classic DAW track colors */
export const TRACK_PALETTE = [
  '#2f7dd0',
  '#d0842d',
  '#2fa84f',
  '#c9a227',
  '#8b5cf6',
  '#d93d3d',
  '#2db8a8',
  '#e0579d',
] as const;

/** Sub / aux bus destinations (before master). `master` = direct to main. */
export type BusId = 'master' | 'reverbA' | 'drumBus' | 'vocalBus';

export const ROUTING_BUS_IDS: BusId[] = ['master', 'reverbA', 'drumBus', 'vocalBus'];

export const MIXER_BUS_STRIPS: Exclude<BusId, 'master'>[] = ['vocalBus', 'drumBus', 'reverbA'];

export type Track = {
  id: string;
  name: string;
  /** Hex, e.g. `#2f7dd0` */
  color: string;
  kind: TrackKind;
  studioTrackType: StudioTrackType;
  fxInserts: FxInsertSlot[];
  /** Optional hardware device id from enumerateDevices (empty = system default). */
  inputDeviceId?: string;
  /** Hear live input in master — parallel tap only; never mixed into recorder. */
  inputMonitoring: boolean;
  /** Input / meter layout (vocal lanes typically mono). */
  channelMode: TrackChannelMode;
  /** Shown in mixer input dropdown (UI + future routing) */
  inputSource: string;
  /** Single red "R" arm at a time recommended */
  recordArm: boolean;
  /** 0 = off (≈−∞ dB), 1 ≈ +6 dB on fader scale (see `faderToGain`) */
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eqPreset: EqPresetId;
  effectPreset: EffectPresetId;
  spacePreset: SpacePresetId;
  /** Post-fader chain destination (default main). */
  outputBus?: BusId;
  /** Reverb send level 0…1 (pre-pan, summed with dry). */
  sendReverb?: number;
  clips: Clip[];
  midiNotes: MidiNote[];
};

const KIND_DEFAULT_NAMES: Record<TrackKind, string> = {
  record_audio: 'Audio',
  create_beat: 'Beat',
  instrument: 'Instrument',
  use_loops: 'Loops',
  import_audio: 'Import',
  play_drums: 'Drums',
};

export function newTrack(name: string, index: number, kind: TrackKind = 'record_audio'): Track {
  const label = name || `${KIND_DEFAULT_NAMES[kind]} ${index + 1}`;
  return {
    id: crypto.randomUUID(),
    name: label,
    color: TRACK_PALETTE[index % TRACK_PALETTE.length]!,
    kind,
    studioTrackType: studioTrackTypeFromKind(kind),
    fxInserts: createDefaultFxInsertSlots(),
    inputDeviceId: undefined,
    inputMonitoring: false,
    channelMode: defaultChannelModeForKind(kind),
    inputSource: typeof navigator !== 'undefined' ? 'Built-in microphone' : 'Default input',
    recordArm: false,
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    eqPreset: 'flat',
    effectPreset: 'none',
    spacePreset: 'off',
    outputBus: 'master',
    sendReverb: 0.18,
    clips: [],
    midiNotes: [],
  };
}
