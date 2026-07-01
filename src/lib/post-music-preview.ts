import { applyFeedVideoAudio } from "@/lib/feed-video-playback";

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

/** Standalone trimmed music preview (camera / no video). */
export function playTrimmedMusicPreview(
  url: string,
  trim: MusicTrim = {},
): { stop: () => void } {
  const audio = new Audio(url);
  audio.volume = trim.volume ?? 1;
  audio.loop = true;

  const applyStart = () => {
    const start = Math.max(0, trim.trimStart ?? 0);
    if (Number.isFinite(start)) audio.currentTime = start;
  };

  audio.addEventListener("loadedmetadata", applyStart, { once: true });

  audio.addEventListener("timeupdate", () => {
    const start = Math.max(0, trim.trimStart ?? 0);
    const end =
      trim.trimEnd && trim.trimEnd > start
        ? trim.trimEnd
        : audio.duration && Number.isFinite(audio.duration)
          ? audio.duration
          : undefined;
    if (end && audio.currentTime >= end - 0.05) {
      audio.currentTime = start;
    }
  });

  void audio.play().catch(() => {});

  return {
    stop: () => {
      audio.pause();
      audio.src = "";
    },
  };
}

/** Play added music in sync with a video while keeping the video vocal track audible. */
export function syncMusicWithVideo(
  video: HTMLVideoElement,
  musicUrl: string,
  options: MusicTrim & { muteOriginal?: boolean } = {},
): () => void {
  const audio = new Audio(musicUrl);
  audio.volume = options.volume ?? 0.85;
  audio.loop = true;

  let fallbackDuration = options.sourceDurationSec ?? 0;

  const applyVideoMute = () => {
    applyFeedVideoAudio(video, { muted: options.muteOriginal === true });
  };

  const syncAudioToVideo = () => {
    const target = videoTimeToMusicTime(video.currentTime, options, fallbackDuration);
    if (Math.abs(audio.currentTime - target) > 0.2) {
      audio.currentTime = target;
    }
  };

  const onLoadedMetadata = () => {
    if (audio.duration && Number.isFinite(audio.duration)) {
      fallbackDuration = audio.duration;
    }
    syncAudioToVideo();
  };

  const onPlay = () => {
    applyVideoMute();
    syncAudioToVideo();
    void audio.play().catch(() => {});
  };

  const onPause = () => {
    audio.pause();
  };

  const onSeeked = () => {
    syncAudioToVideo();
  };

  const onTimeUpdate = () => {
    syncAudioToVideo();
  };

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPause);
  video.addEventListener("seeked", onSeeked);
  video.addEventListener("timeupdate", onTimeUpdate);

  applyVideoMute();
  if (!video.paused) onPlay();

  return () => {
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("timeupdate", onTimeUpdate);
    audio.pause();
    audio.src = "";
  };
}

export function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
