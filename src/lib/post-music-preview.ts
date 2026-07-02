import { applyFeedVideoAudio, bindFeedMediaSession, type FeedPlaybackMeta } from "@/lib/feed-video-playback";

/** Playback mix — video vocal (includes mic recording). */
export const MIXED_VOCAL_VIDEO_VOLUME = 0.78;
/** Playback mix — added song (separate track; kept below vocal bleed in recording). */
export const MIXED_ADDED_MUSIC_VOLUME = 0.52;
/** Add-sound trim sheet only — extra gain above element volume=1. Not used after Done. */
export const TRIM_PICKER_PREVIEW_GAIN = 1.45;

type TrimPickerBoostGraph = {
  ctx: AudioContext;
  gain: GainNode;
};

const trimPickerBoostByAudio = new WeakMap<HTMLAudioElement, TrimPickerBoostGraph>();

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext || w.webkitAudioContext || null;
}

/** Route picker preview through Web Audio so it can exceed HTMLMediaElement volume=1. */
export function ensureTrimPickerAudioBoost(audio: HTMLAudioElement): void {
  const existing = trimPickerBoostByAudio.get(audio);
  if (existing) {
    if (existing.ctx.state === "suspended") void existing.ctx.resume();
    return;
  }

  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = TRIM_PICKER_PREVIEW_GAIN;
    source.connect(gain);
    gain.connect(ctx.destination);
    trimPickerBoostByAudio.set(audio, { ctx, gain });
    audio.volume = 1;
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* element already wired or Web Audio unavailable */
  }
}

export function releaseTrimPickerAudioBoost(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  const graph = trimPickerBoostByAudio.get(audio);
  if (!graph) return;
  trimPickerBoostByAudio.delete(audio);
  void graph.ctx.close().catch(() => {});
}

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

export function sameMediaElementSrc(element: HTMLMediaElement, url: string): boolean {
  if (!url) return !element.src;
  try {
    return element.src === url || element.src === new URL(url, window.location.href).href;
  } catch {
    return element.src === url;
  }
}

export function createTrimmedMusicPlayer(
  url: string,
  trim: MusicTrim = {},
  options: { selfManagedLoop?: boolean; audioElement?: HTMLAudioElement; retainElement?: boolean } = {},
) {
  const selfManagedLoop = options.selfManagedLoop !== false;
  const retainElement = options.retainElement === true;
  const audio = options.audioElement ?? new Audio(url);
  if (!options.audioElement) {
    audio.src = url;
  } else if (!sameMediaElementSrc(audio, url)) {
    audio.src = url;
    try {
      audio.load();
    } catch {
      /* ignore */
    }
  }
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

  let loopHandler: (() => void) | null = null;

  if (selfManagedLoop) {
    loopHandler = () => {
      const start = getStart();
      const end = getEnd();
      if (end && audio.currentTime >= end - 0.05) {
        audio.currentTime = start;
      }
    };
    audio.addEventListener("timeupdate", loopHandler);
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
    if (loopHandler) {
      audio.removeEventListener("timeupdate", loopHandler);
      loopHandler = null;
    }
    if (!retainElement) {
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        /* ignore */
      }
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

/** Keep added sound aligned to video — only correct large drift (avoids loop pumping). */
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
  if (force || drift > 0.85) {
    audio.currentTime = target;
  }
}

export function getMixedPlaybackVolumes(options: {
  muteOriginal?: boolean;
  originalVolume?: number;
  musicVolume?: number;
}): { videoVolume: number; musicVolume: number; videoMuted: boolean } {
  if (options.muteOriginal) {
    return { videoVolume: 0, musicVolume: options.musicVolume ?? 1, videoMuted: true };
  }
  return {
    videoVolume: options.originalVolume ?? MIXED_VOCAL_VIDEO_VOLUME,
    musicVolume: options.musicVolume ?? MIXED_ADDED_MUSIC_VOLUME,
    videoMuted: false,
  };
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
  options: MusicTrim & {
    muteOriginal?: boolean;
    originalVolume?: number;
    mediaSessionMeta?: FeedPlaybackMeta;
  } = {},
): () => void {
  const player = createTrimmedMusicPlayer(musicUrl, options, { selfManagedLoop: false });
  const audio = player.audio;

  const getMix = () =>
    getMixedPlaybackVolumes({
      muteOriginal: options.muteOriginal,
      originalVolume: options.originalVolume,
      musicVolume: options.volume,
    });

  let fallbackDuration = options.sourceDurationSec ?? 0;
  let mediaSessionCleanup: (() => void) | null = null;

  const applyMixLevels = () => {
    const mix = getMix();
    audio.volume = mix.musicVolume;
    applyFeedVideoAudio(video, {
      muted: mix.videoMuted,
      volume: mix.videoVolume,
    });
  };

  const bindSession = () => {
    mediaSessionCleanup?.();
    mediaSessionCleanup = bindFeedMediaSession(
      audio,
      options.mediaSessionMeta ?? { title: "Preview" },
    );
  };

  const syncAudioToVideo = (force = false) => {
    syncTrimmedAudioToVideo(video, audio, options, fallbackDuration, force);
  };

  const ensureMusicPlaying = () => {
    applyMixLevels();
    syncAudioToVideo(true);
    if (!video.paused && audio.paused) {
      void player.play().then((ok) => {
        if (ok) bindSession();
      });
      return;
    }
    if (!audio.paused) bindSession();
  };

  const onLoadedMetadata = () => {
    if (audio.duration && Number.isFinite(audio.duration)) {
      fallbackDuration = audio.duration;
    }
    ensureMusicPlaying();
  };

  const onPlay = () => {
    ensureMusicPlaying();
    if (audio.paused) {
      void player.play().then((ok) => {
        if (ok) bindSession();
      });
    }
  };

  const onPause = () => {
    audio.pause();
  };

  const onSeeked = () => {
    ensureMusicPlaying();
  };

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPause);
  video.addEventListener("seeked", onSeeked);

  applyMixLevels();
  if (!video.paused) {
    syncAudioToVideo(true);
    void player.play().then((ok) => {
      if (ok) bindSession();
    });
  }

  return () => {
    mediaSessionCleanup?.();
    mediaSessionCleanup = null;
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("seeked", onSeeked);
    player.stop();
  };
}

export function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
