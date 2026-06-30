/** iOS Safari needs explicit extensions — audio/* alone opens the photo library. */
export const AUDIO_FILE_ACCEPT =
  ".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/*";

export type FeedMusicMeta =
  | {
      audioUrl?: string;
      fileName?: string;
      /** @deprecated legacy posts only — no volume UI */
      volume?: number;
      durationSec?: number;
      /** @deprecated legacy DAW loop posts */
      loopId?: string;
    }
  | undefined;

export function playUploadedAudio(
  url: string,
  volume = 1,
  loop = true,
  maxDurationSec?: number,
): { stop: () => void; audio: HTMLAudioElement } {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.loop = loop && !(maxDurationSec && maxDurationSec > 0);

  let durationTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (durationTimer) clearTimeout(durationTimer);
    audio.pause();
    audio.src = "";
  };

  void audio.play().catch(() => {});

  if (maxDurationSec && maxDurationSec > 0) {
    durationTimer = setTimeout(stop, maxDurationSec * 1000);
  }

  return { audio, stop };
}

/** Preview attached sound during edit/preview — not mixed into camera recording. */
export function playPostMusic(
  music: FeedMusicMeta,
  filePreviewUrl?: string | null,
): { stop: () => void } | null {
  const url = filePreviewUrl || music?.audioUrl;
  if (!url) return null;

  const dur =
    music?.durationSec && music.durationSec > 0 ? music.durationSec : undefined;

  return playUploadedAudio(url, 1, !dur, dur);
}

export function getMusicDisplayName(music?: {
  fileName?: string;
  audioUrl?: string;
}): string {
  if (!music) return "Original sound";
  if (music.fileName) return music.fileName.replace(/\.[^.]+$/, "");
  if (music.audioUrl) return "Added sound";
  return "Original sound";
}
