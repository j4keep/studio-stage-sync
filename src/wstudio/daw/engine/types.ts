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

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
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
}

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
