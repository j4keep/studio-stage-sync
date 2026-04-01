// Paste your new types code here
export type Clip = { id: string; startTime: number; buffer: AudioBuffer };
export type TrackKind = "record_audio";
export type EqPresetId = "flat";
export type EffectPresetId = "none";
export type Track = { id: string; name: string; clips: Clip[] };
