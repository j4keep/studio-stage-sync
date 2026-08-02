import {
  getAudioDurationSec,
  needsPhotoBattleSongTrim,
} from "@/lib/photo-battle-song";

export type PhotoBattleSongPickResult =
  | { kind: "ready"; file: File; durationSec: number }
  | { kind: "needs_trim"; file: File; durationSec: number };

/** Inspect an uploaded photo-battle song: keep short clips, trim longer tracks. */
export async function preparePhotoBattleSong(file: File): Promise<PhotoBattleSongPickResult> {
  const durationSec = await getAudioDurationSec(file);
  if (needsPhotoBattleSongTrim(durationSec)) {
    return { kind: "needs_trim", file, durationSec };
  }
  return { kind: "ready", file, durationSec };
}
