import type { Track, TrackChannelMode, TrackKind } from "./types";

export type ChannelSourceType = "mic" | "instrument" | "keyboard" | "audio" | "bus" | "master";

export type ChannelConfig = {
  id: string;
  name: string;
  sourceType: ChannelSourceType;
  inputMode: TrackChannelMode;
  /** e.g. [1] mono input, [1, 2] stereo pair — reserved for future hardware maps */
  hardwareInputs?: number[];
};

function sourceTypeFromTrackKind(kind: TrackKind): ChannelSourceType {
  switch (kind) {
    case "record_audio":
      return "mic";
    case "instrument":
      return "keyboard";
    case "import_audio":
    case "use_loops":
      return "audio";
    case "create_beat":
    case "play_drums":
      return "audio";
  }
}

export function trackToChannelConfig(tr: Track): ChannelConfig {
  return {
    id: tr.id,
    name: tr.name,
    sourceType: sourceTypeFromTrackKind(tr.kind),
    inputMode: tr.channelMode,
    hardwareInputs: undefined,
  };
}

export function resolveStereo(config: ChannelConfig): boolean {
  if (config.inputMode === "stereo") return true;
  if (config.inputMode === "mono") return false;

  if (config.hardwareInputs && config.hardwareInputs.length >= 2) return true;

  if (config.sourceType === "keyboard") return true;
  if (config.sourceType === "audio") return true;

  return false;
}

export function trackShowsStereoMeters(tr: Track): boolean {
  return resolveStereo(trackToChannelConfig(tr));
}
