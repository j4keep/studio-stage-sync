import { applyFeedVideoAudio, bindFeedMediaSession, forceIosAudioSessionToPlayback, unlockFeedAudioSession, type FeedPlaybackMeta } from "@/lib/feed-video-playback";

/** Playback mix — video vocal (includes mic recording). */
export const MIXED_VOCAL_VIDEO_VOLUME = 1;
/** Playback mix — added song (separate track) at normal social-app media volume. */
export const MIXED_ADDED_MUSIC_VOLUME = 1;
/** TikTok-style playback when added sound replaces the video track. */
export const ADDED_SOUND_PLAYBACK_VOLUME = 1;
/** Camera lip-sync monitor — full media volume while recording; not used on edit/feed playback. */
export const CAMERA_ADDED_SOUND_MONITOR_VOLUME = 1;

export function getAddedSoundVideoSyncOptions(
  hasMusic: boolean,
  meta: { muteOriginal?: boolean; music?: { volume?: number } } = {},
): { muteOriginal: boolean; volume: number } {
  if (!hasMusic) {
    return {
      muteOriginal: meta.muteOriginal ?? false,
      volume: meta.music?.volume ?? MIXED_ADDED_MUSIC_VOLUME,
    };
  }

  const replaceOriginal = meta.muteOriginal ?? false;

  if (replaceOriginal) {
    return {
      muteOriginal: true,
      volume: meta.music?.volume ?? ADDED_SOUND_PLAYBACK_VOLUME,
    };
  }

  return {
    muteOriginal: false,
    volume: meta.music?.volume ?? MIXED_ADDED_MUSIC_VOLUME,
  };
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

// Cache WebAudio boost so tapping Preview/Play repeatedly doesn't leak nodes.
const boostedElements = new WeakMap<HTMLMediaElement, { ctx: AudioContext; gain: GainNode }>();

/** Route an <audio>/<video> element through a WebAudio GainNode > 1 so iOS/Android
 *  preview and mixed playback are as loud as TikTok/Instagram. Safe to call repeatedly. */
export function boostMediaElementLoudness(media: HTMLMediaElement, gainValue = 2.2): void {
  try {
    let entry = boostedElements.get(media);
    if (!entry) {
      const AC: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(media);
      const gain = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      src.connect(gain).connect(comp).connect(ctx.destination);
      entry = { ctx, gain };
      boostedElements.set(media, entry);
    }
    entry.gain.gain.value = gainValue;
    if (entry.ctx.state === "suspended") {
      void entry.ctx.resume().catch(() => {});
    }
  } catch {
    /* creating a MediaElementSource twice throws — safe to ignore. */
  }
}

export function createTrimmedMusicPlayer(
  url: string,
  trim: MusicTrim = {},
  options: { selfManagedLoop?: boolean; audioElement?: HTMLMediaElement; retainElement?: boolean } = {},
) {
  const selfManagedLoop = options.selfManagedLoop !== false;
  const retainElement = options.retainElement === true;
  const audio = options.audioElement ?? new Audio();
  if (!options.audioElement) {
    audio.crossOrigin = "anonymous";
    audio.src = url;
  } else if (!sameMediaElementSrc(audio, url)) {
    audio.crossOrigin = "anonymous";
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
      forceIosAudioSessionToPlayback();
      await seekToTrimStart();
      audio.muted = false;
      audio.volume = trim.volume ?? 1;
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

/** Play added music in sync with video — when muteOriginal, TikTok-style song-only playback. */
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
  const replacingOriginal = options.muteOriginal === true;

  const getMix = () =>
    getMixedPlaybackVolumes({
      muteOriginal: options.muteOriginal,
      originalVolume: options.originalVolume,
      musicVolume: options.volume,
    });

  let fallbackDuration = options.sourceDurationSec ?? 0;
  let mediaSessionCleanup: (() => void) | null = null;
  let pendingVideoResume = false;

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
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    mediaSessionCleanup = bindFeedMediaSession(
      audio,
      options.mediaSessionMeta ?? { title: "Preview" },
    );
  };

  const syncAudioToVideo = (force = false) => {
    syncTrimmedAudioToVideo(video, audio, options, fallbackDuration, force);
  };

  const startFromMusicReady = () => {
    applyMixLevels();
    syncAudioToVideo(true);
    bindSession();
    void player.play().then((ok) => {
      if (!ok) return;
      if (pendingVideoResume || !video.paused) {
        pendingVideoResume = false;
        void video.play().catch(() => {});
      }
    });
  };

  const startSyncedMusic = () => {
    if (replacingOriginal && audio.paused) {
      startFromMusicReady();
      return;
    }
    applyMixLevels();
    syncAudioToVideo(true);
    bindSession();
    if (!video.paused && audio.paused) {
      void player.play();
    }
  };

  const onLoadedMetadata = () => {
    if (audio.duration && Number.isFinite(audio.duration)) {
      fallbackDuration = audio.duration;
    }
    startFromMusicReady();
  };

  const onPlay = () => {
    startSyncedMusic();
  };

  const onPause = () => {
    audio.pause();
  };

  const onSeeked = () => {
    startSyncedMusic();
  };

  const onVideoPlaying = () => {
    if (replacingOriginal) return;
    bindSession();
    if (audio.paused && !video.paused) {
      void player.play();
    }
  };

  if (replacingOriginal && !video.paused) {
    pendingVideoResume = true;
    video.pause();
  }

  audio.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
  video.addEventListener("play", onPlay);
  video.addEventListener("playing", onVideoPlaying);
  video.addEventListener("pause", onPause);
  video.addEventListener("seeked", onSeeked);

  applyMixLevels();

  if (replacingOriginal) {
    if (audio.readyState >= 1) {
      startFromMusicReady();
    }
  } else if (!video.paused) {
    startSyncedMusic();
  }

  return () => {
    mediaSessionCleanup?.();
    mediaSessionCleanup = null;
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("play", onPlay);
    video.removeEventListener("playing", onVideoPlaying);
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
