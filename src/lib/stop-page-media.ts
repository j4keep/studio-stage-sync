type StopOpts = {
  /**
   * When true (default), tear down LiveKit / srcObject tracks.
   * Use false when opening the feed viewer — hard-detaching streams races
   * battle autoplay and glitches the active slide.
   */
  detachStreams?: boolean;
};

/** Pause/mute every media element on the page — kills leaked post/battle audio. */
export function stopAllPageMedia(opts: StopOpts = {}): void {
  if (typeof document === "undefined") return;
  const detachStreams = opts.detachStreams !== false;
  document.querySelectorAll("video, audio").forEach((node) => {
    const media = node as HTMLMediaElement;
    try {
      // Never pause/mute the durable live-battle record sinks — that freezes
      // the Zoom recording to cover-art fallbacks mid-debate.
      if (
        media instanceof HTMLVideoElement &&
        media.hasAttribute("data-battle-record-sink")
      ) {
        return;
      }
      media.pause();
      media.muted = true;
      // Soft stop (viewer open): keep volume so the next audible play() isn't stuck at 0.
      // Hard stop (close/leave): zero volume so nothing leaks in the background.
      if (detachStreams) media.volume = 0;
      if (detachStreams && media.srcObject) {
        const stream = media.srcObject as MediaStream;
        stream.getTracks?.().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
        media.srcObject = null;
      }
    } catch {
      /* ignore */
    }
  });
}
