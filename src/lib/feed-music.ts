/** iOS Safari needs explicit extensions — audio/* alone opens the photo library. */
import { forceIosAudioSessionToPlayback } from "@/lib/feed-video-playback";

export const AUDIO_FILE_ACCEPT =
  ".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/*";

export type FeedMusicMeta =
  | {
      audioUrl?: string;
      fileName?: string;
      durationSec?: number;
      trimStart?: number;
      trimEnd?: number;
      volume?: number;
    }
  | undefined;

export function playUploadedAudio(
  url: string,
  options: {
    loop?: boolean;
    maxDurationSec?: number;
    autoplay?: boolean;
    trimStart?: number;
    trimEnd?: number;
    volume?: number;
    /** When true, skip internal trim looping — video sync drives position. */
    externallySynced?: boolean;
  } = {},
): { stop: () => void; audio: HTMLAudioElement } {
  const {
    loop = true,
    maxDurationSec,
    autoplay = true,
    trimStart = 0,
    trimEnd,
    volume = 1,
    externallySynced = false,
  } = options;

  const audio = new Audio(url);
  audio.volume = volume;
  audio.loop = false;
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");

  let durationTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (durationTimer) clearTimeout(durationTimer);
    audio.pause();
    audio.src = "";
  };

  const start = Math.max(0, trimStart);

  audio.addEventListener(
    "loadedmetadata",
    () => {
      audio.currentTime = start;
    },
    { once: true },
  );

  if (!externallySynced && loop && !(maxDurationSec && maxDurationSec > 0)) {
    audio.addEventListener("timeupdate", () => {
      const end =
        trimEnd && trimEnd > start
          ? trimEnd
          : audio.duration && Number.isFinite(audio.duration)
            ? audio.duration
            : undefined;
      if (end && audio.currentTime >= end - 0.05) {
        audio.currentTime = start;
      }
    });
  }

  if (autoplay) {
    forceIosAudioSessionToPlayback();
    void audio.play().catch(() => {});
  }

  if (maxDurationSec && maxDurationSec > 0) {
    durationTimer = setTimeout(stop, maxDurationSec * 1000);
  }

  return { audio, stop };
}

/** Preview attached sound during create — respects trim window. */
export function playPostMusic(
  music: FeedMusicMeta,
  filePreviewUrl?: string | null,
): { stop: () => void } | null {
  const url = filePreviewUrl || music?.audioUrl;
  if (!url) return null;

  const trimStart = music?.trimStart ?? 0;
  const trimEnd = music?.trimEnd;
  const segmentLen =
    trimEnd && trimEnd > trimStart
      ? trimEnd - trimStart
      : music?.durationSec && music.durationSec > trimStart
        ? music.durationSec - trimStart
        : undefined;

  return playUploadedAudio(url, {
    loop: true,
    trimStart,
    trimEnd,
    maxDurationSec: segmentLen,
    autoplay: true,
    volume: music?.volume ?? 1,
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
