/** Feed video playback — use iOS media volume, not quiet inline/ambient routing. */

export type FeedPlaybackMeta = {
  title?: string;
  artist?: string;
};

let feedAudioSessionUnlocked = false;

/** Phones/tablets need a user gesture before unmuted playback (iOS Safari). */
export function isTouchFeedDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export function getFeedMountRadius() {
  // Keep next/prev posts mounted so swipe doesn't cold-start a new <video>.
  return isTouchFeedDevice() ? 2 : 3;
}

/** Wait until Safari has enough buffered to start playback. */
export function waitForVideoCanPlay(video: HTMLVideoElement, timeoutMs = 5000): Promise<boolean> {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("loadeddata", onReady);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => finish(true);
    video.addEventListener("canplay", onReady);
    video.addEventListener("loadeddata", onReady);
    video.preload = "auto";
    try {
      video.load();
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(
      () => finish(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA),
      timeoutMs,
    );
  });
}

export function isFeedAudioSessionUnlocked() {
  return feedAudioSessionUnlocked;
}

export function unlockFeedAudioSession() {
  feedAudioSessionUnlocked = true;
  window.dispatchEvent(new Event("feed-audio-unlocked"));
  window.dispatchEvent(new Event("feed-start-audible"));
}

let gestureUnlockAttached = false;

/** One shared listener so any tap on the feed unlocks audio for the active video. */
export function initFeedAudioUnlockOnGesture() {
  if (gestureUnlockAttached || typeof window === "undefined") return;
  gestureUnlockAttached = true;

  const onGesture = () => {
    if (feedAudioSessionUnlocked) return;
    unlockFeedAudioSession();
  };

  const opts = { capture: true, passive: true } as AddEventListenerOptions;
  window.addEventListener("pointerdown", onGesture, opts);
  window.addEventListener("touchstart", onGesture, opts);
  window.addEventListener("click", onGesture, opts);
}

export function applyFeedVideoAudio(
  video: HTMLVideoElement,
  options: { muted: boolean; volume?: number } = { muted: false },
) {
  video.volume = options.muted ? 0 : Math.min(1, Math.max(0, options.volume ?? 1));
  video.defaultMuted = options.muted;
  video.muted = options.muted;
  if (options.muted) {
    video.setAttribute("muted", "");
  } else {
    video.removeAttribute("muted");
  }
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "allow");
}

/** Bind Now Playing / lock-screen controls so iOS uses full media volume. */
export function bindFeedMediaSession(
  source: HTMLMediaElement,
  meta: FeedPlaybackMeta = {},
): () => void {
  if (!("mediaSession" in navigator)) return () => {};

  const title = meta.title?.trim() || "JHi";
  const artist = meta.artist?.trim() || "JHi";

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: "JHi Feed",
    });
  } catch {
    /* MediaMetadata unsupported */
  }

  const syncState = () => {
    navigator.mediaSession.playbackState = source.paused ? "paused" : "playing";
  };

  const onPlay = () => syncState();
  const onPause = () => syncState();

  source.addEventListener("play", onPlay);
  source.addEventListener("pause", onPause);
  syncState();

  try {
    navigator.mediaSession.setActionHandler("play", () => {
      void source.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      source.pause();
    });
  } catch {
    /* action handlers unsupported */
  }

  return () => {
    source.removeEventListener("play", onPlay);
    source.removeEventListener("pause", onPause);
    try {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
    } catch {
      /* ignore */
    }
  };
}

export async function playFeedVideo(
  video: HTMLVideoElement,
  meta: FeedPlaybackMeta = {},
  options: { muted: boolean } = { muted: false },
): Promise<boolean> {
  applyFeedVideoAudio(video, options);
  try {
    await video.play();
    return true;
  } catch {
    return false;
  }
}

export function applyFeedAudioElementVolume(audio: HTMLAudioElement) {
  audio.volume = 1;
}

/** Unlock iOS media volume and bind session before play — not after. */
export function armFeedAudioPlayback(
  audio: HTMLAudioElement,
  meta: FeedPlaybackMeta = {},
  volume = 1,
): () => void {
  unlockFeedAudioSession();
  applyFeedAudioElementVolume(audio);
  audio.volume = Math.min(1, Math.max(0, volume));
  return bindFeedMediaSession(audio, meta);
}

export async function resetIosAudioSessionToPlayback(): Promise<void> {
  /* no-op — previous workaround disabled */
}
