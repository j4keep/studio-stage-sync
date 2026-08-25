/** Real-time face-tracking AR filters (Snapchat/Instagram/TikTok-style) using MediaPipe's
 *  Face Landmarker, loaded from CDN on demand — same lazy-load philosophy as
 *  usePodcastLiveRoom's sibling, useBackgroundReplacement (that one segments background;
 *  this one tracks ~478 face points and draws stickers anchored to them). Returns a
 *  canvas the caller renders locally, and — for publishing to a live viewer — an
 *  `outputTrack` captured straight off that canvas.
 */
import { useEffect, useRef, useState } from "react";

export type FaceFilterId = "none" | "dog" | "cat" | "bunny" | "glasses" | "crown" | "hearts";

export const FACE_FILTERS: { id: FaceFilterId; label: string; emoji: string }[] = [
  { id: "none", label: "None", emoji: "🚫" },
  { id: "dog", label: "Puppy", emoji: "🐶" },
  { id: "cat", label: "Kitty", emoji: "🐱" },
  { id: "bunny", label: "Bunny", emoji: "🐰" },
  { id: "glasses", label: "Shades", emoji: "😎" },
  { id: "crown", label: "Crown", emoji: "👑" },
  { id: "hearts", label: "Hearts", emoji: "🥰" },
];

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<any> | null = null;
/** Exported so useBeautyEffects (skin/contour/makeup) shares the same cached model
 *  instance instead of loading MediaPipe a second time. */
export async function loadFaceLandmarker(): Promise<any> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    // @vite-ignore — a runtime CDN URL, not a build-time module specifier.
    const vision = await import(/* @vite-ignore */ `${CDN_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
    });
  })();
  return landmarkerPromise;
}

// MediaPipe Face Mesh topology — stable, well-known landmark indices.
const L_EYE_OUTER = 33;
const R_EYE_OUTER = 263;
const FOREHEAD = 10;
const NOSE_TIP = 1;

type Pt = { x: number; y: number };

function faceGeometry(lm: { x: number; y: number }[], w: number, h: number) {
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const leftEye = p(L_EYE_OUTER);
  const rightEye = p(R_EYE_OUTER);
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  return {
    eyeDist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    eyeCenter: { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 },
    forehead: p(FOREHEAD),
    nose: p(NOSE_TIP),
  };
}

function drawEmoji(ctx: CanvasRenderingContext2D, at: Pt, size: number, angle: number, emoji: string, offsetY = 0) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, offsetY);
  ctx.restore();
}

function drawEllipseEar(ctx: CanvasRenderingContext2D, at: Pt, size: number, angle: number, fill: string, innerFill: string) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = innerFill;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.08, size * 0.2, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTriangleEar(ctx: CanvasRenderingContext2D, at: Pt, size: number, angle: number, mirror: boolean, fill: string, innerFill: string) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  const s = mirror ? -1 : 1;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-size * 0.35, size * 0.55);
  ctx.lineTo(s * size * 0.15, -size * 0.55);
  ctx.lineTo(size * 0.35, size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = innerFill;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.42);
  ctx.lineTo(s * size * 0.1, -size * 0.28);
  ctx.lineTo(size * 0.2, size * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFilter(ctx: CanvasRenderingContext2D, lm: { x: number; y: number }[], w: number, h: number, filterId: FaceFilterId) {
  const g = faceGeometry(lm, w, h);
  const unit = g.eyeDist; // baseline scale — everything below is proportional to eye distance
  const earY = g.forehead.y - unit * 0.35;
  const leftAnchor: Pt = { x: g.forehead.x - unit * 0.95, y: earY };
  const rightAnchor: Pt = { x: g.forehead.x + unit * 0.95, y: earY };

  switch (filterId) {
    case "dog":
      drawEllipseEar(ctx, leftAnchor, unit * 1.5, g.angle, "#7a4a2b", "#c98a58");
      drawEllipseEar(ctx, rightAnchor, unit * 1.5, g.angle, "#7a4a2b", "#c98a58");
      drawEmoji(ctx, g.nose, unit * 1.1, g.angle, "🐽");
      break;
    case "cat":
      drawTriangleEar(ctx, leftAnchor, unit * 1.7, g.angle, false, "#4a4a4a", "#f2b6c6");
      drawTriangleEar(ctx, rightAnchor, unit * 1.7, g.angle, true, "#4a4a4a", "#f2b6c6");
      drawEmoji(ctx, g.nose, unit * 0.8, g.angle, "🐽");
      break;
    case "bunny": {
      const bunnyY = g.forehead.y - unit * 1.1;
      drawEllipseEar(ctx, { x: g.forehead.x - unit * 0.4, y: bunnyY }, unit * 2.2, g.angle, "#f4f1ea", "#f2b6c6");
      drawEllipseEar(ctx, { x: g.forehead.x + unit * 0.4, y: bunnyY }, unit * 2.2, g.angle, "#f4f1ea", "#f2b6c6");
      break;
    }
    case "glasses":
      drawEmoji(ctx, g.eyeCenter, unit * 3.1, g.angle, "😎");
      break;
    case "crown":
      drawEmoji(ctx, g.forehead, unit * 2.2, g.angle, "👑", -unit * 0.9);
      break;
    case "hearts":
      drawEmoji(ctx, { x: g.eyeCenter.x - unit * 0.85, y: g.eyeCenter.y }, unit * 0.9, g.angle, "❤️");
      drawEmoji(ctx, { x: g.eyeCenter.x + unit * 0.85, y: g.eyeCenter.y }, unit * 0.9, g.angle, "❤️");
      break;
  }
}

/** `colorFilter` is a plain CSS filter string (e.g. from getEffectFilter) — the same
 *  Effects picker used for post/video capture, applied here via canvas ctx.filter so it
 *  actually reaches viewers of a live instead of only the host's own local preview. */
export function useFaceFilters(
  videoTrack: MediaStreamTrack | null,
  filterId: FaceFilterId,
  enabled: boolean,
  colorFilter?: string,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputTrack, setOutputTrack] = useState<MediaStreamTrack | null>(null);
  const hasColorFilter = !!colorFilter && colorFilter !== "none";
  const needsFaceTracking = filterId !== "none";

  useEffect(() => {
    if (!enabled || !videoTrack || (!needsFaceTracking && !hasColorFilter)) {
      setActive(false);
      setLoading(false);
      setError(null);
      setOutputTrack(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let captured: MediaStream | null = null;
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    (video as any).playsInline = true;
    try {
      video.srcObject = new MediaStream([videoTrack]);
    } catch {
      /* ignore */
    }

    setLoading(true);
    setError(null);
    setActive(false);

    (async () => {
      try {
        const landmarker = needsFaceTracking ? await loadFaceLandmarker() : null;
        if (cancelled) return;
        await video.play().catch(() => {});

        let canvas = canvasRef.current;
        for (let i = 0; i < 40 && !canvas && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 50));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelled) {
          if (!cancelled) setError("Canvas not ready");
          setLoading(false);
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("2D context unavailable");
          setLoading(false);
          return;
        }

        const loop = () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              if (canvas!.width !== w || canvas!.height !== h) {
                canvas!.width = w;
                canvas!.height = h;
              }
              ctx.clearRect(0, 0, w, h);
              ctx.filter = hasColorFilter ? colorFilter! : "none";
              ctx.drawImage(video, 0, 0, w, h);
              ctx.filter = "none"; // stickers below draw crisp, not color-filtered too
              if (landmarker) {
                try {
                  const result = landmarker.detectForVideo(video, performance.now());
                  const lm = result?.faceLandmarks?.[0];
                  if (lm) drawFilter(ctx, lm, w, h, filterId);
                } catch {
                  /* skip this frame */
                }
              }
              if (!cancelled) {
                setActive(true);
                setLoading(false);
                if (!captured && (canvas as any).captureStream) {
                  captured = (canvas as any).captureStream(30);
                  setOutputTrack(captured!.getVideoTracks()[0] ?? null);
                }
              }
            }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();

        window.setTimeout(() => {
          if (!cancelled && !canvas!.width) {
            setError("Face filter timed out — try again");
            setLoading(false);
          }
        }, 12000);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Face filter failed");
          setLoading(false);
          setActive(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      captured?.getTracks().forEach((t) => t.stop());
      try {
        (video.srcObject as MediaStream | null) = null;
      } catch {
        /* ignore */
      }
    };
  }, [videoTrack, filterId, enabled, colorFilter, hasColorFilter, needsFaceTracking]);

  return { canvasRef, active, loading, error, outputTrack };
}
