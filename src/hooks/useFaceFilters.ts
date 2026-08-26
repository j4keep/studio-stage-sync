/** Real-time face-tracking AR filters (Snapchat/Instagram/TikTok-style) using MediaPipe's
 *  Face Landmarker, loaded from CDN on demand — same lazy-load philosophy as
 *  usePodcastLiveRoom's sibling, useBackgroundReplacement (that one segments background;
 *  this one tracks ~478 face points and draws stickers anchored to them). Also bakes
 *  Enhance (Filters / Appearance / Makeup) into the same canvas so Post + Live previews
 *  actually change. Returns a canvas the caller renders locally, and — for publishing to
 *  a live viewer — an `outputTrack` captured straight off that canvas.
 */
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ENHANCE,
  enhanceNeedsCanvas,
  MAKEUP_PRESETS,
  type EnhanceSettings,
} from "@/lib/create-modes";

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
/** Exported so other face-landmark features can share the same cached model
 *  instance instead of loading MediaPipe a second time. */
export async function loadFaceLandmarker(): Promise<any> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    // @vite-ignore — a runtime CDN URL, not a build-time module specifier.
    const vision = await import(/* @vite-ignore */ `${CDN_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);
    try {
      return await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    } catch {
      // GPU compute (WebGL) can be unavailable or flaky in embedded WebViews — CPU delegate
      // is slower but far more broadly supported, and beats a hard failure.
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    }
  })();
  return landmarkerPromise;
}

// MediaPipe Face Mesh topology — stable, well-known landmark indices.
const L_EYE_OUTER = 33;
const R_EYE_OUTER = 263;
const FOREHEAD = 10;
const CHIN = 152;
const L_FACE = 234;
const R_FACE = 454;
const NOSE_TIP = 1;
const L_CHEEK = 50;
const R_CHEEK = 280;
const MOUTH_L = 61;
const MOUTH_R = 291;
const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
/** Outer lip ring — keeps lipstick on the mouth instead of a giant oval. */
const OUTER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LEFT_BROW = [70, 63, 105, 66, 107];
const RIGHT_BROW = [300, 293, 334, 296, 336];

type Pt = { x: number; y: number };

function faceGeometry(lm: { x: number; y: number }[], w: number, h: number) {
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const leftEye = p(L_EYE_OUTER);
  const rightEye = p(R_EYE_OUTER);
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const forehead = p(FOREHEAD);
  const chin = p(CHIN);
  const leftEdge = p(L_FACE);
  const rightEdge = p(R_FACE);
  return {
    eyeDist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    leftEye,
    rightEye,
    eyeCenter: { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 },
    forehead,
    nose: p(NOSE_TIP),
    leftCheek: p(L_CHEEK),
    rightCheek: p(R_CHEEK),
    mouthL: p(MOUTH_L),
    mouthR: p(MOUTH_R),
    mouthTop: p(MOUTH_TOP),
    mouthBottom: p(MOUTH_BOTTOM),
    faceCenter: { x: (leftEdge.x + rightEdge.x) / 2, y: (forehead.y + chin.y) / 2 },
    faceRx: Math.abs(rightEdge.x - leftEdge.x) / 2,
    faceRy: Math.abs(chin.y - forehead.y) / 2,
  };
}

function softBlob(ctx: CanvasRenderingContext2D, at: Pt, radius: number, color: string) {
  const r = Math.max(1, radius);
  const grad = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function fillLandmarkPath(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number }[],
  indices: number[],
  w: number,
  h: number,
) {
  if (indices.length < 2) return;
  ctx.beginPath();
  indices.forEach((idx, i) => {
    const x = lm[idx].x * w;
    const y = lm[idx].y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

function strokeLandmarkPoly(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number }[],
  indices: number[],
  w: number,
  h: number,
  lineWidth: number,
) {
  if (indices.length < 2) return;
  ctx.beginPath();
  indices.forEach((idx, i) => {
    const x = lm[idx].x * w;
    const y = lm[idx].y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
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

/** Soft enhance looks (Appearance + Makeup). Filters are applied via CSS on the
 *  visible video/canvas — canvas filter was unreliable on mobile Safari. */
function applyEnhanceLooks(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  lm: { x: number; y: number }[],
  w: number,
  h: number,
  enhance: EnhanceSettings,
) {
  const g = faceGeometry(lm, w, h);
  const unit = g.eyeDist;

  if (enhance.smooth > 0) {
    const t = enhance.smooth / 100;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.faceCenter.x, g.faceCenter.y, g.faceRx * 0.92, g.faceRy * 0.92, 0, 0, Math.PI * 2);
    // Punch eyes + mouth so features stay sharp
    ctx.ellipse(g.leftEye.x, g.leftEye.y, unit * 0.42, unit * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(g.rightEye.x, g.rightEye.y, unit * 0.42, unit * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(
      (g.mouthL.x + g.mouthR.x) / 2,
      (g.mouthTop.y + g.mouthBottom.y) / 2,
      Math.abs(g.mouthR.x - g.mouthL.x) * 0.55,
      Math.max(unit * 0.22, Math.abs(g.mouthBottom.y - g.mouthTop.y) * 0.9),
      0,
      0,
      Math.PI * 2,
    );
    ctx.clip("evenodd");
    ctx.filter = `blur(${2 + t * 5}px)`;
    ctx.globalAlpha = 0.35 + t * 0.45;
    ctx.drawImage(source, 0, 0, w, h);
    ctx.filter = "none";
    ctx.restore();
  }

  if (enhance.shape > 0) {
    const a = (enhance.shape / 100) * 0.45;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = a;
    softBlob(ctx, g.leftCheek, unit * 0.9, "rgba(70,45,38,1)");
    softBlob(ctx, g.rightCheek, unit * 0.9, "rgba(70,45,38,1)");
    softBlob(ctx, { x: g.faceCenter.x - g.faceRx * 0.85, y: g.faceCenter.y + unit * 0.2 }, unit * 0.7, "rgba(65,40,35,1)");
    softBlob(ctx, { x: g.faceCenter.x + g.faceRx * 0.85, y: g.faceCenter.y + unit * 0.2 }, unit * 0.7, "rgba(65,40,35,1)");
    ctx.restore();
  }

  if (enhance.eye > 0) {
    const a = (enhance.eye / 100) * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a * 0.65;
    softBlob(ctx, g.leftEye, unit * 0.42, "rgba(255,255,255,1)");
    softBlob(ctx, g.rightEye, unit * 0.42, "rgba(255,255,255,1)");
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = a * 0.5;
    softBlob(ctx, g.leftEye, unit * 0.5, "rgba(255,248,240,1)");
    softBlob(ctx, g.rightEye, unit * 0.5, "rgba(255,248,240,1)");
    ctx.restore();
  }

  if (enhance.makeupId) {
    const look = MAKEUP_PRESETS.find((m) => m.id === enhance.makeupId);
    if (look) {
      // Soft face glow / foundation
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.35;
      softBlob(ctx, g.faceCenter, Math.max(g.faceRx, g.faceRy) * 0.85, look.highlight);
      ctx.restore();

      // Blush
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      softBlob(ctx, g.leftCheek, unit * 0.75, look.blush);
      softBlob(ctx, g.rightCheek, unit * 0.75, look.blush);
      ctx.restore();

      // Eyeshadow
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      softBlob(ctx, { x: g.leftEye.x, y: g.leftEye.y - unit * 0.12 }, unit * 0.48, look.eyeshadow);
      softBlob(ctx, { x: g.rightEye.x, y: g.rightEye.y - unit * 0.12 }, unit * 0.48, look.eyeshadow);
      ctx.restore();

      // Brows
      ctx.save();
      ctx.strokeStyle = look.brow;
      ctx.globalAlpha = 0.85;
      strokeLandmarkPoly(ctx, lm, LEFT_BROW, w, h, Math.max(1.5, unit * 0.07));
      strokeLandmarkPoly(ctx, lm, RIGHT_BROW, w, h, Math.max(1.5, unit * 0.07));
      ctx.restore();

      // Lips — landmark path, not an oversized ellipse
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = look.lip;
      fillLandmarkPath(ctx, lm, OUTER_LIP, w, h);
      ctx.restore();
    }
  }
}

function enhanceNeedsLandmarks(enhance: EnhanceSettings | null | undefined): boolean {
  if (!enhance) return false;
  return enhanceNeedsCanvas(enhance);
}

/** `colorFilter` is a plain CSS filter string (e.g. from getEffectFilter) — the same
 *  Effects picker used for post/video capture, applied here via canvas ctx.filter so it
 *  actually reaches viewers of a live instead of only the host's own local preview.
 *  `enhance` bakes Enhance → Filters / Appearance / Makeup into the same pass. */
export function useFaceFilters(
  videoTrack: MediaStreamTrack | null,
  filterId: FaceFilterId,
  enabled: boolean,
  colorFilter?: string,
  enhance?: EnhanceSettings | null,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputTrack, setOutputTrack] = useState<MediaStreamTrack | null>(null);
  const enhanceRef = useRef<EnhanceSettings>(enhance ?? DEFAULT_ENHANCE);
  enhanceRef.current = enhance ?? DEFAULT_ENHANCE;

  const hasColorFilter = !!colorFilter && colorFilter !== "none";
  // Recompute from prop for effect deps (ref alone wouldn't retrigger structural enable).
  const enhanceCanvas = !!enhance && enhanceNeedsCanvas(enhance);
  const needsFaceTracking = filterId !== "none" || enhanceCanvas;
  const pipelineOn = needsFaceTracking || hasColorFilter;

  useEffect(() => {
    if (!enabled || !videoTrack || !pipelineOn) {
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
              const enh = enhanceRef.current;

              ctx.clearRect(0, 0, w, h);
              // Base frame (Effects color-filter baked for live publish when passed in)
              ctx.filter = hasColorFilter ? colorFilter! : "none";
              ctx.drawImage(video, 0, 0, w, h);
              ctx.filter = "none";

              // Enhance Filters are applied via CSS on the visible element (more reliable
              // than ctx.filter on mobile). Canvas only paints Appearance / Makeup / Face.

              if (landmarker) {
                try {
                  const result = landmarker.detectForVideo(video, performance.now());
                  const lm = result?.faceLandmarks?.[0];
                  if (lm) {
                    if (enhanceNeedsCanvas(enh)) applyEnhanceLooks(ctx, video, lm, w, h, enh);
                    if (filterId !== "none") drawFilter(ctx, lm, w, h, filterId);
                  }
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
    // Slider values flow through enhanceRef — only structural enhance on/off restarts the loop.
  }, [videoTrack, filterId, enabled, colorFilter, hasColorFilter, needsFaceTracking, pipelineOn, enhanceCanvas]);

  return { canvasRef, active, loading, error, outputTrack };
}
