/** iOS Safari needs explicit extensions — audio/* alone opens the photo library. */
export const AUDIO_FILE_ACCEPT =
  ".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/*";

export type FeedMusicMeta =
  | {
      audioUrl?: string;
      fileName?: string;
      durationSec?: number;
    }
  | undefined;

export function playUploadedAudio(
  url: string,
  options: {
    loop?: boolean;
    maxDurationSec?: number;
    autoplay?: boolean;
  } = {},
): { stop: () => void; audio: HTMLAudioElement } {
  const { loop = true, maxDurationSec, autoplay = true } = options;

  const audio = new Audio(url);
  audio.volume = 1;
  audio.loop = loop && !(maxDurationSec && maxDurationSec > 0);

  let durationTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (durationTimer) clearTimeout(durationTimer);
    audio.pause();
    audio.src = "";
  };

  if (autoplay) {
    void audio.play().catch(() => {});
  }

  if (maxDurationSec && maxDurationSec > 0) {
    durationTimer = setTimeout(stop, maxDurationSec * 1000);
  }

  return { audio, stop };
}

/** Preview attached sound during edit — plays instead of (muted) camera audio. */
export function playPostMusic(
  music: FeedMusicMeta,
  filePreviewUrl?: string | null,
): { stop: () => void } | null {
  const url = filePreviewUrl || music?.audioUrl;
  if (!url) return null;

  const dur =
    music?.durationSec && music.durationSec > 0 ? music.durationSec : undefined;

  return playUploadedAudio(url, {
    loop: !dur,
    maxDurationSec: dur,
    autoplay: true,
  });
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
