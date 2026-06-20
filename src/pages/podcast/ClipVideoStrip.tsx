import { useEffect, useRef, useState } from "react";
import { usePodcastVideoStore } from "@/pages/podcast/podcastVideoStore";

/**
 * Renders a strip of video thumbnails on top of a clip's waveform, so a
 * podcast video clip looks like the reference DAW (video lane stacked on
 * top of the audio lane). Cuts and trims to the underlying clip apply to
 * the video too — when the clip's offset/duration changes, the thumbnails
 * follow because we sample the video at the clip's offset window.
 */
export function ClipVideoStrip({ clipId, width, height, offsetSec, durationSec }: {
  clipId: string;
  width: number;
  height: number;
  offsetSec: number;
  durationSec: number;
}) {
  const entry = usePodcastVideoStore(s => s.videos[clipId]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.src = entry.url;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;

    const draw = async () => {
      await new Promise<void>(res => {
        if (video.readyState >= 1) return res();
        video.onloadedmetadata = () => res();
      });
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
      const thumbW = Math.max(24, Math.floor(h * aspect));
      const count = Math.max(1, Math.ceil(w / thumbW));
      const stepX = w / count;
      const totalDur = video.duration || (entry.durationSec ?? durationSec);

      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        const t = offsetSec + ((i + 0.5) / count) * durationSec;
        const clamped = Math.max(0, Math.min(Math.max(0.001, totalDur - 0.05), t));
        await new Promise<void>((res) => {
          const onSeek = () => { video.removeEventListener("seeked", onSeek); res(); };
          video.addEventListener("seeked", onSeek);
          try { video.currentTime = clamped; } catch { res(); }
        });
        if (cancelled) return;
        try {
          ctx.drawImage(video, i * stepX, 0, stepX, h);
        } catch {/* ignore decode errors */}
      }
      if (!cancelled) setReady(true);
    };
    draw();
    return () => { cancelled = true; try { video.src = ""; } catch {} };
  }, [entry?.url, width, height, offsetSec, durationSec]);

  if (!entry) return null;
  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full"
      style={{ opacity: ready ? 1 : 0.6, transition: "opacity 200ms" }}
    />
  );
}
