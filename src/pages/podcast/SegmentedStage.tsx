import { useEffect, useRef } from "react";

// Loads MediaPipe Selfie Segmentation on demand from the CDN so we don't
// bloat the bundle. Singleton promise — we only inject the <script> once.
let scriptPromise: Promise<void> | null = null;
function loadMediaPipe(): Promise<void> {
  if ((window as any).SelfieSegmentation) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("Failed to load segmentation model")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Renders the camera stream onto a canvas with the person's background
 * replaced by `bgUrl` (true selfie-segmentation). Falls back to a plain
 * mirrored video if MediaPipe fails to load.
 */
export function SegmentedStage({
  stream, bgUrl, mirrored, className,
}: {
  stream: MediaStream | null;
  bgUrl: string | null;
  mirrored: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const mirroredRef = useRef(mirrored);
  const bgUrlRef = useRef(bgUrl);

  // Keep latest props available to the long-lived paint loop without restarting it.
  useEffect(() => { mirroredRef.current = mirrored; }, [mirrored]);
  useEffect(() => { bgUrlRef.current = bgUrl; }, [bgUrl]);

  useEffect(() => {
    if (!bgUrl) { bgImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { bgImgRef.current = img; };
    img.src = bgUrl;
  }, [bgUrl]);

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    let raf = 0;
    let seg: any = null;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const playPromise = video.play().catch(() => {});

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawCover = (img: CanvasImageSource, w: number, h: number) => {
      const sw = (img as HTMLImageElement).naturalWidth || (img as HTMLVideoElement).videoWidth || w;
      const sh = (img as HTMLImageElement).naturalHeight || (img as HTMLVideoElement).videoHeight || h;
      const scale = Math.max(w / sw, h / sh);
      const dw = sw * scale, dh = sh * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    (async () => {
      await playPromise;
      if (cancelled) return;
      try { await loadMediaPipe(); } catch { /* fall back to plain video below */ }
      if (cancelled) return;

      const SS = (window as any).SelfieSegmentation;
      if (SS) {
        try {
          seg = new SS({
            locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
          });
          seg.setOptions({ modelSelection: 1, selfieMode: false });
          seg.onResults((results: any) => {
            if (cancelled) return;
            const w = results.image.width || video.videoWidth || 640;
            const h = results.image.height || video.videoHeight || 480;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;

            ctx.save();
            ctx.clearRect(0, 0, w, h);
            if (mirroredRef.current) { ctx.translate(w, 0); ctx.scale(-1, 1); }

            if (bgUrlRef.current && bgImgRef.current) {
              // Person silhouette only.
              ctx.drawImage(results.segmentationMask, 0, 0, w, h);
              ctx.globalCompositeOperation = "source-in";
              ctx.drawImage(results.image, 0, 0, w, h);
              // Background fills everything not yet painted.
              ctx.globalCompositeOperation = "destination-over";
              drawCover(bgImgRef.current, w, h);
            } else {
              ctx.drawImage(results.image, 0, 0, w, h);
            }
            ctx.restore();
          });
        } catch { seg = null; }
      }

      const pump = async () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (seg) {
            try { await seg.send({ image: video }); } catch {}
          } else {
            // Fallback: plain mirrored video, no segmentation.
            const w = video.videoWidth, h = video.videoHeight;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            ctx.save();
            ctx.clearRect(0, 0, w, h);
            if (mirroredRef.current) { ctx.translate(w, 0); ctx.scale(-1, 1); }
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          }
        }
        raf = requestAnimationFrame(pump);
      };
      pump();
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      try { seg?.close?.(); } catch {}
      try { video.pause(); video.srcObject = null; } catch {}
    };
  }, [stream]);

  return <canvas ref={canvasRef} className={className} />;
}
