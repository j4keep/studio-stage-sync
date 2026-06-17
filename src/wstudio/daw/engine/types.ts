export type TrackKind = "audio" | "instrument";

export interface Clip {
  id: string;
  trackId: string;
  /** Seconds on the timeline */
  startTime: number;
  /** Length in seconds (visible) */
  duration: number;
  /** Offset into the source buffer in seconds */
  offset: number;
  /** Audio buffer for audio clips */
  buffer?: AudioBuffer;
  /** Cached peaks for waveform rendering (mono, min/max pairs) */
  peaks?: Float32Array;
  /** Display name */
  name: string;
  /** MIDI notes for instrument clips */
  notes?: MidiNote[];
  color?: string;
}

export interface MidiNote {
  id: string;
  /** Beat position from clip start */
  start: number;
  /** Length in beats */
  length: number;
  /** MIDI pitch 0-127 */
  pitch: number;
  velocity: number;
}

export type EffectId =
  | "eq3"
  | "compressor"
  | "reverb"
  | "delay"
  | "chorus"
  | "distortion"
  | "limiter"
  | "pitch";

export interface EffectInstance {
  id: string;
  type: EffectId | "user";
  /** For user plug-ins */
  pluginKey?: string;
  enabled: boolean;
  params: Record<string, number>;
}

export interface AutomationPoint {
  /** Time in seconds on the timeline */
  t: number;
  /** Normalized 0..1 (volume) or -1..1 (pan) */
  v: number;
}

export type AutomationParam = "volume" | "pan";

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  /** Per-track automation lanes */
  automation?: Partial<Record<AutomationParam, AutomationPoint[]>>;
  /** Whether the automation lane is visible under this track */
  automationOpen?: boolean;
  /** Which parameter is being edited in the automation lane */
  automationParam?: AutomationParam;
  /** Audio tracks that accept live mic/input recording. Imported beat/file tracks set this false. */
  inputEnabled?: boolean;
  color: string;
  volume: number; // 0-1 (linear), UI shows dB
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  armed: boolean;
  inputDeviceId?: string;
  effects: EffectInstance[];
  reverbSend: number; // 0-1
  delaySend: number; // 0-1
  /** For instrument tracks */
  instrument?: "synth" | "drum";
  /** Display name of current instrument preset (e.g. "Bright Synth") */
  instrumentPreset?: string;
  /** Synth waveform / tone for the simple Web Audio synth (legacy fallback) */
  synthWave?: "sine" | "triangle" | "sawtooth" | "square";
  /** For drum instrument tracks — selected drum kit name (e.g. "808", "909") */
  drumKit?: string;
}

export type KeyRoot = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
export type KeyMode = "major" | "minor";
export type TempoMode = "keep" | "adapt" | "auto";
export type BBTDisplayMode = "beats-project" | "beats-time" | "beats" | "time";

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  /** Seconds */
  position: number;
  bpm: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  metronome: boolean;
  /** Click level 0..1, independent from master / monitor mix */
  metronomeVolume: number;
  /** Use a different (higher) pitch on beat 1 of each bar */
  metroAccent: boolean;
  /** Bars of count-in before recording (0 = off) */
  metroCountInBars: number;
  /** Optional dedicated audio output device for click (separate from master) */
  metroOutputDeviceId?: string;
  /** Musical key root */
  keyRoot: KeyRoot;
  /** Major / minor */
  keyMode: KeyMode;
  /** Beats per bar (numerator) */
  timeSigNum: number;
  /** Beat unit (denominator: 2,4,8,16) */
  timeSigDen: number;
  /** Smart Tempo mode for imported audio */
  tempoMode: TempoMode;
  /** How the BBT/time readout in the transport bar renders */
  bbtDisplayMode: BBTDisplayMode;
}

export interface UserPlugin {
  key: string;
  name: string;
  manifest: {
    name: string;
    params: { id: string; label: string; min: number; max: number; default: number }[];
  };
  wasmUrl?: string;
}
