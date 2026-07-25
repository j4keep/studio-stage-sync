import { forceIosAudioSessionToPlayback, unlockFeedAudioSession } from "@/lib/feed-video-playback";

let primedUntil = 0;
let primingVideo: HTMLVideoElement | null = null;

/** True briefly after a user gesture that successfully primed unmuted media. */
export function wasMediaGestureRecentlyPrimed(windowMs = 12_000) {
  return Date.now() < primedUntil && primedUntil - Date.now() < windowMs;
}

/**
 * Call synchronously inside a click/pointerup handler before opening a viewer.
 * Chrome/Safari only allow unmuted playback when media starts under a user gesture —
 * mounting a React video later is too late, so we prime here.
 */
export function primeMediaPlaybackGesture(mediaUrl?: string | null) {
  forceIosAudioSessionToPlayback();
  unlockFeedAudioSession();
  primedUntil = Date.now() + 12_000;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const w = window as typeof window & { __yajAudioCtx?: AudioContext };
      if (!w.__yajAudioCtx) w.__yajAudioCtx = new AudioCtx();
      void w.__yajAudioCtx.resume();
    }
  } catch {
    /* ignore */
  }

  if (!mediaUrl) return;

  try {
    if (primingVideo) {
      try {
        primingVideo.pause();
        primingVideo.removeAttribute("src");
        primingVideo.load();
      } catch {
        /* ignore */
      }
      primingVideo = null;
    }

    const v = document.createElement("video");
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.preload = "auto";
    v.muted = false;
    v.defaultMuted = false;
    v.volume = 0.001;
    v.src = mediaUrl;
    primingVideo = v;

    void v
      .play()
      .then(() => {
        primedUntil = Date.now() + 12_000;
        window.setTimeout(() => {
          if (primingVideo !== v) return;
          try {
            v.pause();
            v.removeAttribute("src");
            v.load();
          } catch {
            /* ignore */
          }
          primingVideo = null;
        }, 600);
      })
      .catch(() => {
        // Still mark primed — AudioContext resume may be enough for the next play().
        try {
          v.muted = true;
          void v.play().finally(() => {
            try {
              v.pause();
              v.removeAttribute("src");
              v.load();
            } catch {
              /* ignore */
            }
            if (primingVideo === v) primingVideo = null;
          });
        } catch {
          primingVideo = null;
        }
      });
  } catch {
    /* ignore */
  }
}
