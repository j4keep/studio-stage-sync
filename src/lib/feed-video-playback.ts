/** Feed video playback — use iOS media volume, not quiet inline/ambient routing. */

export type FeedPlaybackMeta = {
  title?: string;
  artist?: string;
};

type BrowserAudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

function forceBrowserAudioSession(type: BrowserAudioSessionType): void {
  try {
    const nav = navigator as Navigator & {
      audioSession?: { type?: BrowserAudioSessionType };
    };
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    /* unsupported */
  }
}

export function applyFeedVideoAudio(
  video: HTMLVideoElement,
  options: { muted: boolean } = { muted: false },
) {
  forceBrowserAudioSession("playback");
  video.volume = 1;
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
      forceBrowserAudioSession("playback");
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
  forceBrowserAudioSession("playback");
  audio.volume = 1;
}

/**
 * iOS Safari pins the page into the "PlayAndRecord" audio session as soon as
 * getUserMedia({audio:true}) runs, which routes <video>/<audio> playback to
 * the quiet earpiece — even after the mic tracks are stopped. Playing a brief
 * non-zero volume silent <audio> element nudges Safari back to the loud 
 * "Playback" category so post-capture preview plays through the main speaker.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function resetIosAudioSessionToPlayback(): void {
  try {
    forceBrowserAudioSession("playback");
    const a = new Audio(SILENT_WAV);
    a.volume = 0.01; // Non-zero volume helps trigger the session switch on some iOS versions
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        window.setTimeout(() => {
          try { 
            a.pause(); 
            a.src = ""; 
            a.load();
          } catch { /* ignore */ }
        }, 100);
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
