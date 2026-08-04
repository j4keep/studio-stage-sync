/** Pause/mute every media element on the page — kills leaked post/battle audio. */
export function stopAllPageMedia(): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll("video, audio").forEach((node) => {
    const media = node as HTMLMediaElement;
    try {
      media.pause();
      media.muted = true;
      media.volume = 0;
      // Detach streams so LiveKit / srcObject audio cannot keep playing.
      if (media.srcObject) {
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
