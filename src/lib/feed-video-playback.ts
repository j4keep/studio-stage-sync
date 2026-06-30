/** Feed video playback — iOS media volume after camera/mic use. */

export type FeedPlaybackMeta = {
  title?: string;
  artist?: string;
};

function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Tell iOS to use full media volume (not quiet play-and-record routing). */
export function setPlaybackAudioSession() {
  try {
    if ("audioSession" in navigator && navigator.audioSession) {
      navigator.audioSession.type = "playback";
    }
  } catch {
    /* unsupported */
  }
}

/**
 * After the camera mic stops, iOS can keep audio routed quietly until we
 * explicitly switch back to playback — lock screen already does this for us.
 */
export function resetAudioSessionAfterMic() {
  setPlaybackAudioSession();
  window.setTimeout(setPlaybackAudioSession, 150);
  window.setTimeout(setPlaybackAudioSession, 500);
}

export function applyFeedVideoAudio(
  video: HTMLVideoElement,
  options: { muted: boolean } = { muted: false },
) {
  video.volume = 1;
  video.muted = options.muted;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "allow");
}

/** Bind Now Playing / lock-screen controls. */
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
      resetAudioSessionAfterMic();
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
  _meta: FeedPlaybackMeta = {},
  options: { muted: boolean } = { muted: false },
): Promise<boolean> {
  resetAudioSessionAfterMic();
  applyFeedVideoAudio(video, options);

  if (!options.muted && isAppleMobile()) {
    video.muted = true;
    try {
      await video.play();
    } catch {
      /* continue */
    }
    applyFeedVideoAudio(video, options);
  }

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

export async function activateFeedVideoPlayback(
  video: HTMLVideoElement,
  meta: FeedPlaybackMeta = {},
  options: { muted: boolean } = { muted: false },
): Promise<void> {
  resetAudioSessionAfterMic();
  await playFeedVideo(video, meta, options);
  if (!options.muted) {
    bindFeedMediaSession(video, meta);
  }
}
