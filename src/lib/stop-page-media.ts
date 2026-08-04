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
      media.pause();
      media.muted = true;
      media.volume = 0;
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
