import { applyFeedVideoAudio } from "@/lib/feed-video-playback";

/** Video vocal level when mixed with a separate added-sound track (reduces mic bleed pumping). */
export const MIXED_VOCAL_VIDEO_VOLUME = 0.32;

export type MusicTrim = {
  trimStart?: number;
  trimEnd?: number;
  sourceDurationSec?: number;
  volume?: number;
};

export function musicSegmentLength(trim: MusicTrim, fallbackDuration = 0): number {
  const start = Math.max(0, trim.trimStart ?? 0);
  const end =
    trim.trimEnd && trim.trimEnd > start
      ? trim.trimEnd
      : trim.sourceDurationSec && trim.sourceDurationSec > start
        ? trim.sourceDurationSec
        : fallbackDuration > start
          ? fallbackDuration
          : start + 1;
  return Math.max(0.1, end - start);
}

export function videoTimeToMusicTime(videoTime: number, trim: MusicTrim, fallbackDuration = 0): number {
  const start = Math.max(0, trim.trimStart ?? 0);
  const len = musicSegmentLength(trim, fallbackDuration);
  const offset = ((videoTime % len) + len) % len;
  return start + offset;
}

export function createTrimmedMusicPlayer(
  url: string,
  trim: MusicTrim = {},
  options: { selfManagedLoop?: boolean } = {},
) {
  const selfManagedLoop = options.selfManagedLoop !== false;
  const audio = new Audio(url);
  audio.volume = trim.volume ?? 1;
  audio.loop = false;
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");

  const getStart = () => Math.max(0, trim.trimStart ?? 0);

  const getEnd = () => {
    const start = getStart();
    if (trim.trimEnd && trim.trimEnd > start) return trim.trimEnd;
    if (audio.duration && Number.isFinite(audio.duration)) return audio.duration;
    if (trim.sourceDurationSec && trim.sourceDurationSec > start) return trim.sourceDurationSec;
    return undefined;
  };

  if (selfManagedLoop) {
    audio.addEventListener("timeupdate", () => {
      const start = getStart();
      const end = getEnd();
      if (end && audio.currentTime >= end - 0.05) {
        audio.currentTime = start;
      }
    });
  }

  const seekToTrimStart = async () => {
    if (audio.readyState >= 1) {
      audio.currentTime = getStart();
      return;
    }
    await new Promise<void>((resolve) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      audio.load();
    });
    audio.currentTime = getStart();
  };

  const play = async (): Promise<boolean> => {
    try {
      await seekToTrimStart();
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const stop = () => {
    audio.pause();
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch {
      /* ignore */
    }
  };

  return { audio, play, stop };
}

function musicDriftSec(audioTime: number, targetTime: number, segmentLen: number): number {
  const direct = Math.abs(audioTime - targetTime);
  if (segmentLen <= 0) return direct;
  const wrapped = Math.min(
    Math.abs(audioTime - targetTime + segmentLen),
    Math.abs(audioTime - targetTime - segmentLen),
  );
  return Math.min(direct, wrapped);
}

/** Keep added sound aligned to video without constant micro-seeks (prevents volume pumping). */
export function syncTrimmedAudioToVideo(
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
  trim: MusicTrim,
  fallbackDuration = 0,
  force = false,
): void {
  const segmentLen = musicSegmentLength(trim, fallbackDuration);
  const target = videoTimeToMusicTime(video.currentTime, trim, fallbackDuration);
  const drift = musicDriftSec(audio.currentTime, target, segmentLen);
  if (force || drift > 0.45) {
    audio.currentTime = target;
  }
}

/** Standalone trimmed music preview (camera / no video). */
export function playTrimmedMusicPreview(
  url: string,
  trim: MusicTrim = {},
): { stop: () => void; play: () => Promise<boolean> } {
  const player = createTrimmedMusicPlayer(url, trim);
  void player.play();
  return player;
}

/** Play added music in sync with a video while keeping the video vocal track audible. */
export function syncMusicWithVideo(
  video: HTMLVideoElement,
  musicUrl: string,
  options: MusicTrim & { muteOriginal?: boolean; originalVolume?: number } = {},
): () => void {
  const player = createTrimmedMusicPlayer(musicUrl, options, { selfManagedLoop: false });
  const audio = player.audio;

  let fallbackDuration = options.sourceDurationSec ?? 0;
  let lastSyncMs = 0;

  const applyVideoMix = () => {
    const muteOriginal = options.muteOriginal === true;
    applyFeedVideoAudio(video, {
      muted: muteOriginal,
      volume: muteOriginal ? 0 : (options.originalVolume ?? MIXED_VOCAL_VIDEO_VOLUME),
    });
  };

  const syncAudioToVideo = (force = false) => {
    const now = performance.now();
    if (!force && now - lastSyncMs < 250) return;
    syncTrimmedAudioToVideo(video, audio, options, fallbackDuration, force);
    lastSyncMs = now;
  };

  const onLoadedMetadata = () => {
    if (audio.duration && Number.isFinite(audio.duration)) {
      fallbackDuration = audio.duration;
    }
    syncAudioToVideo(true);
  };

  const onPlay = () => {
    applyVideoMix();
    syncAudioToVideo(true);
    void player.play();
  };

  const onPause = () => {
    audio.pause();
  };

  const onSeeked = () => {
    syncAudioToVideo(true);
  };

  const onTimeUpdate = () => {
    syncAudioToVideo(false);
  };

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPause);
  video.addEventListener("seeked", onSeeked);
  video.addEventListener("timeupdate", onTimeUpdate);

  applyVideoMix();
  if (!video.paused) {
    syncAudioToVideo(true);
    void player.play();
  }

  return () => {
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("timeupdate", onTimeUpdate);
    player.stop();
  };
}

export function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
