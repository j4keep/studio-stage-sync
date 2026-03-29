export type Clip = {
  id: string;
  startTime: number;
  buffer: AudioBuffer;
};

/** Matches the "Start your song…" style picker */
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
  /** Single red "R" arm at a time recommended */
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
