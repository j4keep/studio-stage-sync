/** Feed video playback — use iOS media volume, not quiet inline/ambient routing. */

export type FeedPlaybackMeta = {
  title?: string;
  artist?: string;
};

let feedAudioSessionUnlocked = false;

export function isFeedAudioSessionUnlocked() {
  return feedAudioSessionUnlocked;
}

export function unlockFeedAudioSession() {
  feedAudioSessionUnlocked = true;
  window.dispatchEvent(new Event("feed-audio-unlocked"));
}

export function applyFeedVideoAudio(
  video: HTMLVideoElement,
  options: { muted: boolean } = { muted: false },
) {
  video.volume = 1;
  video.defaultMuted = options.muted;
  video.muted = options.muted;
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

export async function resetIosAudioSessionToPlayback(): Promise<void> {
  /* no-op — previous workaround disabled */
}
