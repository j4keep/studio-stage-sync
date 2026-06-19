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

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const sw = (img as HTMLImageElement).naturalWidth || (img as HTMLVideoElement).videoWidth || w;
  const sh = (img as HTMLImageElement).naturalHeight || (img as HTMLVideoElement).videoHeight || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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
    const maskCtx = maskCanvas.getContext("2d");

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

    const drawSoftMask = (target: CanvasRenderingContext2D, mask: CanvasImageSource, w: number, h: number) => {
      if (!maskCtx) {
        drawMirrored(target, mask, w, h);
        return;
      }
      if (maskCanvas.width !== w) maskCanvas.width = w;
      if (maskCanvas.height !== h) maskCanvas.height = h;
      maskCtx.clearRect(0, 0, w, h);
      maskCtx.imageSmoothingEnabled = true;
      maskCtx.imageSmoothingQuality = "high";
      maskCtx.filter = "blur(0.35px)";
      maskCtx.drawImage(mask, 0, 0, w, h);
      maskCtx.filter = "none";
      try {
        const frame = maskCtx.getImageData(0, 0, w, h);
        const data = frame.data;
        for (let i = 0; i < data.length; i += 4) {
          const confidence = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          const alpha = Math.round(smoothstep(0.24, 0.54, confidence) * 255);
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = alpha;
        }
        maskCtx.putImageData(frame, 0, 0);
      } catch { /* keep raw mask if canvas readback is blocked */ }
      drawMirrored(target, maskCanvas, w, h);
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
              subjectCtx.filter = "none";
              drawMirrored(subjectCtx, results.image, w, h);
              subjectCtx.globalCompositeOperation = "destination-in";
              drawSoftMask(subjectCtx, results.segmentationMask, w, h);
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
            // Fallback immediately paints the real camera while the model loads.
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
