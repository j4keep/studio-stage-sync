import { DawWorkspacePage } from "./DawWorkspace";

export default function RecordingStudio() {
  return <DawWorkspacePage />;
}

export { DawWorkspacePage } from "./DawWorkspace";
export { DawProvider, useDaw, INPUT_SOURCE_OPTIONS } from "./DawContext";
export { WaveformCanvas } from "./WaveformCanvas";
export type { Track, Clip, TrackKind, EqPresetId, EffectPresetId } from "./types";
export type { LibrarySoundId } from "./audio";
export { LIBRARY_BY_CATEGORY, EQ_PRESET_LABELS, EFFECT_PRESET_LABELS, faderToDbLabel } from "./audio";
