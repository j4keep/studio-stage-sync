/** Real-time background replacement using MediaPipe Selfie Segmentation
 *  loaded from CDN on demand. Returns a canvas the caller renders.
 */
import { useEffect, useRef, useState } from "react";
import type { PodcastBg } from "./podcastBackgrounds";

declare global {
  interface Window {
    SelfieSegmentation?: any;
    __wheuatSelfieSegLoader?: Promise<any>;
  }
}

// Try multiple CDNs in order — first one that loads wins. Helps when one
// CDN blocks WASM/CORS for the user.
const CDN_BASES = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/",
  "https://unpkg.com/@mediapipe/selfie_segmentation@0.1.1675465747/",
];

function loadScript(src: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    const to = window.setTimeout(() => {
      s.remove();
      reject(new Error("timeout " + src));
    }, timeoutMs);
    s.onload = () => { clearTimeout(to); resolve(); };
    s.onerror = () => { clearTimeout(to); reject(new Error("script error " + src)); };
    document.head.appendChild(s);
  });
}

async function loadSelfieSegmentation(): Promise<{ SS: any; base: string }> {
  if (window.SelfieSegmentation && (window as any).__wheuatSelfieSegBase) {
    return { SS: window.SelfieSegmentation, base: (window as any).__wheuatSelfieSegBase };
  }
  let lastErr: any = null;
  for (const base of CDN_BASES) {
    try {
      await loadScript(base + "selfie_segmentation.js");
      if (window.SelfieSegmentation) {
        (window as any).__wheuatSelfieSegBase = base;
        return { SS: window.SelfieSegmentation, base };
      }
    } catch (e) { lastErr = e; }
  }
  throw new Error("Could not load segmentation model" + (lastErr ? ": " + lastErr.message : ""));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Avoid CORS taint for remote http(s) images; not needed for blob:/data:
    if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed: " + url));
    img.src = url;
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = window.setTimeout(() => reject(new Error(label + " timed out")), ms);
    p.then((v) => { clearTimeout(to); resolve(v); }, (e) => { clearTimeout(to); reject(e); });
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
    try { video.srcObject = new MediaStream([videoTrack]); } catch {}

    let bgImg: HTMLImageElement | null = null;

    setLoading(true); setError(null); setActive(false);

    (async () => {
      try {
        if (bg.kind === "image") {
          // Don't let one slow image hang forever
          bgImg = await withTimeout(loadImage(bg.url), 8000, "Background image").catch((e) => {
            console.warn("[bg] image load failed, falling back to blur", e);
            return null;
          });
        }

        const { SS, base } = await withTimeout(loadSelfieSegmentation(), 10000, "Model loader");
        if (cancelled) return;
        seg = new SS({ locateFile: (f: string) => base + f });
        seg.setOptions({ modelSelection: 1, selfieMode: true });
        await withTimeout(Promise.resolve(seg.initialize?.()), 10000, "Model init").catch((e) => {
          // Some versions don't expose initialize; first send() bootstraps. Ignore.
          console.warn("[bg] initialize skipped:", e?.message || e);
        });

        await video.play().catch(() => {});

        let canvas = canvasRef.current;
        for (let i = 0; i < 40 && !canvas && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 50));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelled) { if (!cancelled) setError("Canvas not ready"); setLoading(false); return; }
        const ctx = canvas.getContext("2d");
        if (!ctx) { setError("2D context unavailable"); setLoading(false); return; }

        seg.onResults((results: any) => {
          if (cancelled) return;
          const w = results.image.width || video.videoWidth || 1280;
          const h = results.image.height || video.videoHeight || 720;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
          }
          ctx.save();
          ctx.clearRect(0, 0, w, h);

          ctx.drawImage(results.segmentationMask, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-in";
          ctx.drawImage(results.image, 0, 0, w, h);

          ctx.globalCompositeOperation = "destination-over";
          if (bg.kind === "image" && bgImg) {
            const ir = bgImg.width / bgImg.height;
            const cr = w / h;
            let dw = w, dh = h, dx = 0, dy = 0;
            if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; }
            else { dw = w; dh = w / ir; dy = (h - dh) / 2; }
            ctx.drawImage(bgImg, dx, dy, dw, dh);
          } else if (bg.kind === "blur" || (bg.kind === "image" && !bgImg)) {
            ctx.filter = "blur(14px)";
            ctx.drawImage(results.image, 0, 0, w, h);
            ctx.filter = "none";
          } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();

          // First frame received → mark active
          if (!cancelled) {
            setActive(true);
            setLoading(false);
          }
        });

        const loop = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try { await seg.send({ image: video }); } catch { /* ignore */ }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();

        // Hard cap: if no frame in 12s, surface an error so UI isn't stuck.
        window.setTimeout(() => {
          if (!cancelled && !canvas.width) {
            setError("Background timed out — try again or pick a different effect");
            setLoading(false);
          }
        }, 12000);
      } catch (e: any) {
        if (!cancelled) {
          console.error("[bg] failed", e);
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
