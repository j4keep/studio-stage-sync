import { useEffect, useRef } from "react";

type SegmentationResults = {
  image: CanvasImageSource & { width?: number; height?: number };
  segmentationMask: CanvasImageSource;
};

type SelfieSegmentationInstance = {
  setOptions: (options: { modelSelection: number; selfieMode: boolean }) => void;
  onResults: (callback: (results: SegmentationResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

declare global {
  interface Window {
    SelfieSegmentation?: new (config: { locateFile: (file: string) => string }) => SelfieSegmentationInstance;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadMediaPipe(): Promise<void> {
  if (window.SelfieSegmentation) return Promise.resolve();
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

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const sw = (img as HTMLImageElement).naturalWidth || (img as HTMLVideoElement).videoWidth || w;
  const sh = (img as HTMLImageElement).naturalHeight || (img as HTMLVideoElement).videoHeight || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

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
    let seg: SelfieSegmentationInstance | null = null;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const playPromise = video.play().catch((error) => { void error; });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const subjectCanvas = document.createElement("canvas");
    const subjectCtx = subjectCanvas.getContext("2d");
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

    const drawMirrored = (target: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) => {
      if (mirroredRef.current) {
        target.save();
        target.translate(w, 0);
        target.scale(-1, 1);
        target.drawImage(img, 0, 0, w, h);
        target.restore();
      } else {
        target.drawImage(img, 0, 0, w, h);
      }
    };

    const buildMask = (mask: CanvasImageSource, w: number, h: number) => {
      if (!maskCtx) return mask;
      if (maskCanvas.width !== w) maskCanvas.width = w;
      if (maskCanvas.height !== h) maskCanvas.height = h;
      maskCtx.clearRect(0, 0, w, h);
      maskCtx.filter = "blur(1.25px)";
      maskCtx.drawImage(mask, 0, 0, w, h);
      maskCtx.filter = "none";
      const data = maskCtx.getImageData(0, 0, w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const confidence = Math.max(px[i], px[i + 1], px[i + 2], px[i + 3]) / 255;
        let alpha = smoothstep(0.18, 0.42, confidence);
        if (alpha > 0.88) alpha = 1;
        if (alpha < 0.03) alpha = 0;
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = Math.round(alpha * 255);
      }
      maskCtx.putImageData(data, 0, 0);
      return maskCanvas;
    };

    (async () => {
      await playPromise;
      if (cancelled) return;
      try { await loadMediaPipe(); } catch (error) { void error; }
      if (cancelled) return;

      const SS = window.SelfieSegmentation;
      if (SS) {
        try {
          seg = new SS({
            locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
          });
          seg.setOptions({ modelSelection: 0, selfieMode: false });
          seg.onResults((results) => {
            if (cancelled) return;
            const w = results.image.width || video.videoWidth || 640;
            const h = results.image.height || video.videoHeight || 480;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;

            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            if (bgUrlRef.current && bgImgRef.current && subjectCtx) {
              drawCover(ctx, bgImgRef.current, w, h);

              if (subjectCanvas.width !== w) subjectCanvas.width = w;
              if (subjectCanvas.height !== h) subjectCanvas.height = h;
              subjectCtx.clearRect(0, 0, w, h);
              subjectCtx.imageSmoothingEnabled = true;
              subjectCtx.imageSmoothingQuality = "high";
              subjectCtx.filter = "contrast(1.02) saturate(1.02)";
              drawMirrored(subjectCtx, results.image, w, h);
              subjectCtx.filter = "none";
              subjectCtx.globalCompositeOperation = "destination-in";
              drawMirrored(subjectCtx, buildMask(results.segmentationMask, w, h), w, h);
              subjectCtx.globalCompositeOperation = "source-over";

              ctx.drawImage(subjectCanvas, 0, 0, w, h);
            } else {
              drawMirrored(ctx, results.image, w, h);
            }
          });
        } catch (error) { void error; seg = null; }
      }

      const pump = async () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (seg) {
            try { await seg.send({ image: video }); } catch (error) { void error; }
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
      try { seg?.close?.(); } catch (error) { void error; }
      try { video.pause(); video.srcObject = null; } catch (error) { void error; }
    };
  }, [stream]);

  return <canvas ref={canvasRef} className={className} />;
}
