import { DawWorkspacePage } from "./DawWorkspace";

export default function RecordingStudio() {
  return <DawWorkspacePage />;
}

export { DawWorkspacePage } from "./DawWorkspace";
export { DawProvider, useDaw, INPUT_SOURCE_OPTIONS } from "./DawContext";
export { WaveformCanvas } from "./WaveformCanvas";
export type { Track, Clip, TrackKind, EqPresetId, EffectPresetId, SpacePresetId } from "./types";
export type { LibrarySoundId } from "./audio";
export type { MicChainPresetId } from "./micPresets";
export type { RemoteLibraryItem } from "./remoteLibrary";
export {
  LIBRARY_BY_CATEGORY,
  EQ_PRESET_LABELS,
  EFFECT_PRESET_LABELS,
  SPACE_PRESET_LABELS,
  faderToDbLabel,
} from "./audio";
export { MIC_CHAIN_PRESETS } from "./micPresets";
export { REMOTE_LIBRARY_BY_CATEGORY, REMOTE_LIBRARY_FLAT } from "./remoteLibrary";