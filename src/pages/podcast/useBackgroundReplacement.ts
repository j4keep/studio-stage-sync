/** Real-time background replacement using MediaPipe Selfie Segmentation
 *  loaded from CDN on demand. Returns a canvas the caller renders.
 *
 *  Modes:
 *   - none: no processing, returns null (caller renders plain <video>).
 *   - blur: blur the camera background, keep person sharp.
 *   - image: replace background with the given image URL.
 */
import { useEffect, useRef, useState } from "react";
import type { PodcastBg } from "./podcastBackgrounds";

declare global {
  interface Window {
    SelfieSegmentation?: any;
    __wheuatSelfieSegLoader?: Promise<any>;
  }
}

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/";

function loadSelfieSegmentation(): Promise<any> {
  if (window.SelfieSegmentation) return Promise.resolve(window.SelfieSegmentation);
  if (window.__wheuatSelfieSegLoader) return window.__wheuatSelfieSegLoader;
  window.__wheuatSelfieSegLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CDN + "selfie_segmentation.js";
    s.crossOrigin = "anonymous";
    s.onload = () => {
      if (window.SelfieSegmentation) resolve(window.SelfieSegmentation);
      else reject(new Error("SelfieSegmentation not available"));
    };
    s.onerror = () => reject(new Error("Failed to load segmentation model"));
    document.head.appendChild(s);
  });
  return window.__wheuatSelfieSegLoader;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed: " + url));
    img.src = url;
  });
}

export function useBackgroundReplacement(
  videoTrack: MediaStreamTrack | null,
  bg: PodcastBg,
  enabled: boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !videoTrack || bg.kind === "none") {
      setActive(false); setLoading(false); setError(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let seg: any = null;
    const video = document.createElement("video");
    video.autoplay = true; video.muted = true; (video as any).playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    let bgImg: HTMLImageElement | null = null;

    setLoading(true); setError(null);

    (async () => {
      try {
        if (bg.kind === "image") {
          bgImg = await loadImage(bg.url);
        }
        const SS = await loadSelfieSegmentation();
        if (cancelled) return;
        seg = new SS({ locateFile: (f: string) => CDN + f });
        seg.setOptions({ modelSelection: 1, selfieMode: true });
        await seg.initialize?.();

        await video.play().catch(() => {});

        // Wait briefly for the canvas to mount if it isn't yet (parent renders it
        // conditionally on segEnabled, so it usually IS there — this is just a safety net).
        let canvas = canvasRef.current;
        for (let i = 0; i < 20 && !canvas && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 50));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        seg.onResults((results: any) => {
          if (cancelled) return;
          const w = results.image.width || video.videoWidth || 1280;
          const h = results.image.height || video.videoHeight || 720;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
          }
          ctx.save();
          ctx.clearRect(0, 0, w, h);

          // Draw person using mask
          ctx.drawImage(results.segmentationMask, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-in";
          ctx.drawImage(results.image, 0, 0, w, h);

          // Draw background behind
          ctx.globalCompositeOperation = "destination-over";
          if (bg.kind === "image" && bgImg) {
            // cover-fit
            const ir = bgImg.width / bgImg.height;
            const cr = w / h;
            let dw = w, dh = h, dx = 0, dy = 0;
            if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; }
            else { dw = w; dh = w / ir; dy = (h - dh) / 2; }
            ctx.drawImage(bgImg, dx, dy, dw, dh);
          } else if (bg.kind === "blur") {
            ctx.filter = "blur(14px)";
            ctx.drawImage(results.image, 0, 0, w, h);
            ctx.filter = "none";
          } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();
        });

        setLoading(false);
        setActive(true);

        const loop = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try { await seg.send({ image: video }); } catch { /* ignore */ }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Background failed");
          setLoading(false);
          setActive(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      try { seg?.close?.(); } catch {}
      try { (video.srcObject as MediaStream | null) = null; } catch {}
    };
  }, [videoTrack, bg.kind, bg.kind === "image" ? bg.url : "", enabled]);

  return { canvasRef, active, loading, error };
}
