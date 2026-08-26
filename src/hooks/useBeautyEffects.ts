/** Real face-landmark-driven beauty pipeline (skin smoothing, complexion, contour, 3D
 *  light, makeup looks, color filter) — the engine behind the Beauty panel. Shares
 *  useFaceFilters' cached MediaPipe Face Landmarker instance rather than loading the
 *  model a second time. Not a clone of any platform's proprietary beauty ML — these are
 *  honest, landmark-anchored canvas effects (blur+mask for skin, gradient shading for
 *  contour/light, colored ellipses for lips/blush), same spirit as the sticker filters.
 */
import { useEffect, useRef, useState } from "react";
import { loadFaceLandmarker } from "./useFaceFilters";

export type MakeupLookId = "silverSiren" | "blossomNymph" | "peachII" | "goldenMuse" | "sakuraSheer";

export const MAKEUP_LOOKS: { id: MakeupLookId; label: string; lip: string; blush: string }[] = [
  { id: "silverSiren", label: "Silver Siren", lip: "rgba(140,55,75,0.5)", blush: "rgba(190,130,150,0.22)" },
  { id: "blossomNymph", label: "Blossom Nymph", lip: "rgba(215,110,145,0.45)", blush: "rgba(240,175,195,0.26)" },
  { id: "peachII", label: "Peach II", lip: "rgba(235,135,105,0.45)", blush: "rgba(250,185,155,0.26)" },
  { id: "goldenMuse", label: "Golden Muse", lip: "rgba(195,85,75,0.45)", blush: "rgba(230,165,125,0.26)" },
  { id: "sakuraSheer", label: "Sakura Sheer", lip: "rgba(225,145,165,0.4)", blush: "rgba(250,195,205,0.24)" },
];

export type BeautySettings = {
  /** Master switch for Skin-group tools (Skin / Complexion / Contour / 3D Light / Contrast). */
  skinMasterOn: boolean;
  skinSmooth: number; // 0-100
  complexion: number; // 0-100
  contour: number; // 0-100
  light3d: number; // 0-100
  contrast: number; // 0-100
  makeupId: MakeupLookId | null;
  colorFilter: string; // CSS filter string, "none" if off
  filterIntensity: number; // 0-100
};

export const DEFAULT_BEAUTY: BeautySettings = {
  skinMasterOn: true,
  skinSmooth: 0,
  complexion: 0,
  contour: 0,
  light3d: 0,
  contrast: 0,
  makeupId: null,
  colorFilter: "none",
  filterIntensity: 80,
};

function skinToolsActive(s: BeautySettings): boolean {
  if (!s.skinMasterOn) return false;
  return s.skinSmooth > 0 || s.complexion > 0 || s.contour > 0 || s.light3d > 0 || s.contrast > 0;
}

export function isBeautyActive(s: BeautySettings): boolean {
  return (
    skinToolsActive(s) ||
    !!s.makeupId ||
    (s.colorFilter !== "none" && s.filterIntensity > 0)
  );
}

export function needsLandmarks(s: BeautySettings): boolean {
  return skinToolsActive(s) || !!s.makeupId;
}

// MediaPipe Face Mesh topology — stable, well-known single-point indices. Approximated
// regions (an ellipse for "the face", a couple of points for "a cheek"), not full
// polygon contours through all ~478 points — a deliberate simplicity tradeoff.
const FOREHEAD = 10;
const CHIN = 152;
const L_FACE_EDGE = 234;
const R_FACE_EDGE = 454;
const NOSE_BRIDGE = 168;
const MOUTH_L = 61;
const MOUTH_R = 291;
const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
const L_EYE = 33;
const R_EYE = 263;
const L_CHEEK = 50;
const R_CHEEK = 280;

type Pt = { x: number; y: number };
type Landmarks = { x: number; y: number }[];

function geometry(lm: Landmarks, w: number, h: number) {
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const forehead = p(FOREHEAD);
  const chin = p(CHIN);
  const leftEdge = p(L_FACE_EDGE);
  const rightEdge = p(R_FACE_EDGE);
  return {
    forehead,
    noseBridge: p(NOSE_BRIDGE),
    mouthL: p(MOUTH_L),
    mouthR: p(MOUTH_R),
    mouthTop: p(MOUTH_TOP),
    mouthBottom: p(MOUTH_BOTTOM),
    leftEye: p(L_EYE),
    rightEye: p(R_EYE),
    leftCheek: p(L_CHEEK),
    rightCheek: p(R_CHEEK),
    faceCenter: { x: (leftEdge.x + rightEdge.x) / 2, y: (forehead.y + chin.y) / 2 },
    faceRadiusX: Math.abs(rightEdge.x - leftEdge.x) / 2,
    faceRadiusY: Math.abs(chin.y - forehead.y) / 2,
  };
}

function clipFaceOval(ctx: CanvasRenderingContext2D, g: ReturnType<typeof geometry>) {
  ctx.beginPath();
  ctx.ellipse(g.faceCenter.x, g.faceCenter.y, g.faceRadiusX * 1.05, g.faceRadiusY * 1.05, 0, 0, Math.PI * 2);
  ctx.clip();
}

/** Face oval with eyes + mouth punched out so smoothing doesn't mush features. */
function clipSkinRegion(ctx: CanvasRenderingContext2D, g: ReturnType<typeof geometry>, unit: number) {
  const eyeRx = unit * 0.42;
  const eyeRy = unit * 0.28;
  const browLift = unit * 0.12;
  const mouthCx = (g.mouthL.x + g.mouthR.x) / 2;
  const mouthCy = (g.mouthTop.y + g.mouthBottom.y) / 2;
  const mouthRx = (Math.abs(g.mouthR.x - g.mouthL.x) / 2) * 1.25;
  const mouthRy = Math.max(unit * 0.28, (Math.abs(g.mouthBottom.y - g.mouthTop.y) / 2) * 1.8);

  ctx.beginPath();
  ctx.ellipse(g.faceCenter.x, g.faceCenter.y, g.faceRadiusX * 1.08, g.faceRadiusY * 1.08, 0, 0, Math.PI * 2);
  // Holes (evenodd) — keep brows/eyes/lips crisp
  ctx.ellipse(g.leftEye.x, g.leftEye.y - browLift * 0.2, eyeRx, eyeRy + browLift, 0, 0, Math.PI * 2);
  ctx.ellipse(g.rightEye.x, g.rightEye.y - browLift * 0.2, eyeRx, eyeRy + browLift, 0, 0, Math.PI * 2);
  ctx.ellipse(mouthCx, mouthCy, mouthRx, mouthRy, 0, 0, Math.PI * 2);
  ctx.clip("evenodd");
}

function softBlob(ctx: CanvasRenderingContext2D, at: Pt, radius: number, color: string) {
  const grad = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, Math.max(1, radius));
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(at.x, at.y, Math.max(1, radius), 0, Math.PI * 2);
  ctx.fill();
}

/** Reused every frame — allocating a canvas per RAF would thrash GC on live. */
let skinBlurPlate: HTMLCanvasElement | null = null;
let skinBlurCtx: CanvasRenderingContext2D | null = null;
let skinDownPlate: HTMLCanvasElement | null = null;
let skinDownCtx: CanvasRenderingContext2D | null = null;
/** Alpha layer for feathered skin mask (must support transparency). */
let skinMaskPlate: HTMLCanvasElement | null = null;
let skinMaskCtx: CanvasRenderingContext2D | null = null;

function getSkinBlurPlate(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!skinBlurPlate) {
    skinBlurPlate = document.createElement("canvas");
    skinBlurCtx = skinBlurPlate.getContext("2d", { alpha: false });
  }
  if (!skinBlurCtx) return null;
  if (skinBlurPlate.width !== w || skinBlurPlate.height !== h) {
    skinBlurPlate.width = w;
    skinBlurPlate.height = h;
  }
  return { canvas: skinBlurPlate, ctx: skinBlurCtx };
}

function getSkinDownPlate(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!skinDownPlate) {
    skinDownPlate = document.createElement("canvas");
    skinDownCtx = skinDownPlate.getContext("2d", { alpha: false });
  }
  if (!skinDownCtx) return null;
  if (skinDownPlate.width !== w || skinDownPlate.height !== h) {
    skinDownPlate.width = w;
    skinDownPlate.height = h;
  }
  return { canvas: skinDownPlate, ctx: skinDownCtx };
}

function getSkinMaskPlate(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!skinMaskPlate) {
    skinMaskPlate = document.createElement("canvas");
    skinMaskCtx = skinMaskPlate.getContext("2d", { alpha: true });
  }
  if (!skinMaskCtx) return null;
  if (skinMaskPlate.width !== w || skinMaskPlate.height !== h) {
    skinMaskPlate.width = w;
    skinMaskPlate.height = h;
  }
  return { canvas: skinMaskPlate, ctx: skinMaskCtx };
}

/** Soft face alpha mask: feathered oval, eyes + mouth punched out (no hard sticker edge). */
function paintFeatheredSkinMask(
  mctx: CanvasRenderingContext2D,
  g: ReturnType<typeof geometry>,
  unit: number,
  w: number,
  h: number,
) {
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalAlpha = 1;
  mctx.globalCompositeOperation = "source-over";
  mctx.filter = "none";
  mctx.clearRect(0, 0, w, h);

  const rx = g.faceRadiusX * 1.02;
  const ry = g.faceRadiusY * 1.02;
  const cx = g.faceCenter.x;
  const cy = g.faceCenter.y;
  const grad = mctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.55, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.72, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  mctx.fillStyle = grad;
  mctx.beginPath();
  mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  mctx.fill();

  // Keep eyes + lips crisp
  const eyeRx = unit * 0.48;
  const eyeRy = unit * 0.32;
  const mouthCx = (g.mouthL.x + g.mouthR.x) / 2;
  const mouthCy = (g.mouthTop.y + g.mouthBottom.y) / 2;
  const mouthRx = (Math.abs(g.mouthR.x - g.mouthL.x) / 2) * 1.35;
  const mouthRy = Math.max(unit * 0.3, (Math.abs(g.mouthBottom.y - g.mouthTop.y) / 2) * 1.9);

  mctx.globalCompositeOperation = "destination-out";
  softBlob(mctx, g.leftEye, Math.max(eyeRx, eyeRy), "rgba(0,0,0,1)");
  softBlob(mctx, g.rightEye, Math.max(eyeRx, eyeRy), "rgba(0,0,0,1)");
  softBlob(mctx, { x: mouthCx, y: mouthCy }, Math.max(mouthRx, mouthRy), "rgba(0,0,0,1)");
  mctx.globalCompositeOperation = "source-over";
}

/**
 * Beauty Skin: smooth pores, gentle brighten, matte sweat — without painting a milky face oval.
 * Prior pass used hard evenodd clip + extreme blur + full-rect fills → sticker mask with dark
 * eye/mouth holes. This version uses a feathered mask layer and moderate blend strengths.
 */
function applySkinSmooth(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  g: ReturnType<typeof geometry>,
  unit: number,
  w: number,
  h: number,
  amount: number, // 0-100
) {
  const t = Math.min(1, Math.max(0, amount / 100));
  if (t <= 0) return;

  const plate = getSkinBlurPlate(w, h);
  const mask = getSkinMaskPlate(w, h);
  if (!plate || !mask) return;

  // Moderate downsample — enough to kill pores, not so far that the face becomes a beige blob
  const scale = Math.max(0.28, 0.55 - t * 0.22);
  const dw = Math.max(16, Math.round(w * scale));
  const dh = Math.max(16, Math.round(h * scale));
  const down = getSkinDownPlate(dw, dh);
  if (!down) return;

  down.ctx.setTransform(1, 0, 0, 1, 0, 0);
  down.ctx.globalAlpha = 1;
  down.ctx.globalCompositeOperation = "source-over";
  down.ctx.imageSmoothingEnabled = true;
  down.ctx.imageSmoothingQuality = "high";
  down.ctx.filter = `blur(${0.6 + t * 1.4}px)`;
  down.ctx.drawImage(source, 0, 0, dw, dh);
  down.ctx.filter = "none";

  plate.ctx.setTransform(1, 0, 0, 1, 0, 0);
  plate.ctx.globalAlpha = 1;
  plate.ctx.globalCompositeOperation = "source-over";
  plate.ctx.imageSmoothingEnabled = true;
  plate.ctx.imageSmoothingQuality = "high";
  plate.ctx.filter = `blur(${1.2 + t * 3.5}px)`;
  plate.ctx.drawImage(down.canvas, 0, 0, w, h);
  plate.ctx.filter = "none";

  // Build feathered skin layer: blurred pixels, then masked (no hard oval edge)
  paintFeatheredSkinMask(mask.ctx, g, unit, w, h);
  mask.ctx.globalCompositeOperation = "source-in";
  mask.ctx.drawImage(plate.canvas, 0, 0, w, h);
  mask.ctx.globalCompositeOperation = "source-over";

  // 1) Smooth — blend feathered airbrush; cap so it never reads as a sticker
  ctx.save();
  ctx.globalAlpha = 0.22 + t * 0.38; // ~0.22 → ~0.60
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(mask.canvas, 0, 0, w, h);
  ctx.restore();

  // 2) Brighten — soft radial lifts on cheeks / forehead (not a full cream fillRect)
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.14 + t * 0.28;
  softBlob(ctx, g.leftCheek, unit * 1.15, "rgba(255, 236, 220, 1)");
  softBlob(ctx, g.rightCheek, unit * 1.15, "rgba(255, 236, 220, 1)");
  softBlob(ctx, g.forehead, unit * 1.2, "rgba(255, 240, 228, 1)");
  softBlob(ctx, g.faceCenter, unit * 1.4, "rgba(255, 242, 230, 1)");
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.06 + t * 0.14;
  softBlob(ctx, g.leftCheek, unit * 1.0, "rgba(255, 228, 205, 1)");
  softBlob(ctx, g.rightCheek, unit * 1.0, "rgba(255, 228, 205, 1)");
  ctx.restore();

  // 3) Matte sweat — T-zone soft-light only (kills specular “balls”, no gray disc)
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.16 + t * 0.32;
  softBlob(ctx, g.forehead, unit * 1.15, "rgba(140, 128, 122, 1)");
  softBlob(ctx, g.noseBridge, unit * 0.75, "rgba(135, 122, 116, 1)");
  softBlob(ctx, { x: g.noseBridge.x, y: g.noseBridge.y + unit * 0.5 }, unit * 0.5, "rgba(135, 122, 116, 1)");
  softBlob(ctx, g.leftCheek, unit * 0.7, "rgba(145, 132, 126, 1)");
  softBlob(ctx, g.rightCheek, unit * 0.7, "rgba(145, 132, 126, 1)");
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.05 + t * 0.12;
  softBlob(ctx, g.forehead, unit * 1.0, "rgba(200, 185, 175, 1)");
  softBlob(ctx, g.noseBridge, unit * 0.65, "rgba(195, 180, 170, 1)");
  ctx.restore();
}

/** Draws one processed frame into `ctx`. `source` can be a live <video> or a frozen
 *  <canvas> snapshot — both work as a canvas drawImage source, which is what lets the
 *  thumbnail generator below reuse this exact function instead of a second copy. */
function drawBeauty(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  lm: Landmarks | null,
  w: number,
  h: number,
  settings: BeautySettings,
) {
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(source, 0, 0, w, h);

  const hasFilter = settings.colorFilter !== "none" && settings.filterIntensity > 0;
  if (hasFilter) {
    // Cross-fading a fully-filtered second draw over the base, rather than trying to
    // mathematically scale each CSS filter function's own parameters, gives a real
    // intensity slider that works for any filter string.
    ctx.filter = settings.colorFilter;
    ctx.globalAlpha = Math.min(1, settings.filterIntensity / 100);
    ctx.drawImage(source, 0, 0, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }

  if (!lm) return;
  const g = geometry(lm, w, h);
  const unit = Math.hypot(g.rightEye.x - g.leftEye.x, g.rightEye.y - g.leftEye.y);
  const skinOn = settings.skinMasterOn !== false;

  if (skinOn && settings.skinSmooth > 0) {
    applySkinSmooth(ctx, source, g, unit, w, h, settings.skinSmooth);
  }

  if (skinOn && settings.complexion > 0) {
    // Soft cheek/forehead warmth — avoid hard oval fillRect (reads as a forehead blob)
    const a = (settings.complexion / 100) * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = a;
    softBlob(ctx, g.leftCheek, unit * 1.2, "rgba(255, 220, 190, 1)");
    softBlob(ctx, g.rightCheek, unit * 1.2, "rgba(255, 220, 190, 1)");
    softBlob(ctx, g.forehead, unit * 1.1, "rgba(255, 228, 200, 1)");
    softBlob(ctx, g.faceCenter, unit * 1.35, "rgba(255, 224, 196, 1)");
    ctx.restore();
  }

  if (skinOn && settings.contour > 0) {
    ctx.save();
    ctx.globalAlpha = (settings.contour / 100) * 0.4;
    ctx.globalCompositeOperation = "multiply";
    softBlob(ctx, g.leftCheek, unit * 0.9, "rgba(70,45,40,1)");
    softBlob(ctx, g.rightCheek, unit * 0.9, "rgba(70,45,40,1)");
    ctx.restore();
  }

  if (skinOn && settings.light3d > 0) {
    ctx.save();
    ctx.globalAlpha = (settings.light3d / 100) * 0.4;
    ctx.globalCompositeOperation = "screen";
    softBlob(ctx, g.forehead, unit * 1.1, "rgba(255,255,255,1)");
    softBlob(ctx, g.noseBridge, unit * 0.6, "rgba(255,255,255,1)");
    ctx.restore();
  }

  if (skinOn && settings.contrast > 0) {
    ctx.save();
    clipFaceOval(ctx, g);
    const amount = 1 + (settings.contrast / 100) * 0.45;
    ctx.filter = `contrast(${amount})`;
    ctx.globalAlpha = Math.min(0.75, 0.25 + settings.contrast / 140);
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
  }

  if (settings.makeupId) {
    const look = MAKEUP_LOOKS.find((m) => m.id === settings.makeupId);
    if (look) {
      const mouthCx = (g.mouthL.x + g.mouthR.x) / 2;
      const mouthCy = (g.mouthTop.y + g.mouthBottom.y) / 2;
      const mouthRx = (Math.abs(g.mouthR.x - g.mouthL.x) / 2) * 1.05;
      const mouthRy = Math.max(unit * 0.22, (Math.abs(g.mouthBottom.y - g.mouthTop.y) / 2) * 1.4);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = look.lip;
      ctx.beginPath();
      ctx.ellipse(mouthCx, mouthCy, mouthRx, mouthRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      softBlob(ctx, g.leftCheek, unit * 0.8, look.blush);
      softBlob(ctx, g.rightCheek, unit * 0.8, look.blush);
      ctx.restore();
    }
  }
}

export function useBeautyEffects(videoTrack: MediaStreamTrack | null, settings: BeautySettings, enabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputTrack, setOutputTrack] = useState<MediaStreamTrack | null>(null);
  // Landmark-dependent effects (skin/complexion/contour/3D light/makeup) need a face MediaPipe
  // can actually lock onto — backlighting, extreme angles, or being out of frame can mean no
  // face is found frame after frame, which otherwise looks indistinguishable from "the preset
  // does nothing." Tracked so the panel can say so instead of failing silently.
  const [faceDetected, setFaceDetected] = useState(false);
  const lastFaceDetectedRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const needsFaceTracking = needsLandmarks(settings);

  useEffect(() => {
    if (!enabled || !videoTrack) {
      setActive(false);
      setLoading(false);
      setError(null);
      setOutputTrack(null);
      setFaceDetected(false);
      lastFaceDetectedRef.current = false;
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
              let lm: Landmarks | null = null;
              if (landmarker) {
                try {
                  const result = landmarker.detectForVideo(video, performance.now());
                  lm = result?.faceLandmarks?.[0] ?? null;
                } catch {
                  /* skip this frame's detection */
                }
                const found = !!lm;
                if (found !== lastFaceDetectedRef.current) {
                  lastFaceDetectedRef.current = found;
                  setFaceDetected(found);
                }
              }
              drawBeauty(ctx, video, lm, w, h, settingsRef.current);
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
            setError("Beauty preview timed out — try again");
            setLoading(false);
          }
        }, 12000);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Beauty preview failed");
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
    // Only whether landmark tracking is structurally needed (re)starts the pipeline —
    // slider/toggle value changes flow through settingsRef and apply next frame without
    // tearing down and reconnecting the video/model.
  }, [videoTrack, enabled, needsFaceTracking]);

  return { canvasRef, active, loading, error, outputTrack, faceDetected, needsFaceTracking };
}

// ---- Thumbnails: a separate IMAGE-mode landmarker (VIDEO-mode instances aren't safe to
// call concurrently from two independent loops), one detection pass per refresh, then a
// cheap drawBeauty() call per preset/look reusing those same landmarks. ----

let imageLandmarkerPromise: Promise<any> | null = null;
async function loadImageLandmarker(): Promise<any> {
  if (imageLandmarkerPromise) return imageLandmarkerPromise;
  imageLandmarkerPromise = (async () => {
    const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17";
    const MODEL_URL =
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
    // @vite-ignore — a runtime CDN URL, not a build-time module specifier.
    const vision = await import(/* @vite-ignore */ `${CDN_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);
    try {
      return await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    } catch {
      // Same GPU→CPU fallback as the live VIDEO-mode landmarker in useFaceFilters.
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    }
  })();
  return imageLandmarkerPromise;
}

export async function detectSnapshotLandmarks(source: HTMLVideoElement): Promise<Landmarks | null> {
  if (!source.videoWidth) return null;
  try {
    const landmarker = await loadImageLandmarker();
    const result = landmarker.detect(source);
    return result?.faceLandmarks?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Renders one preset/look thumbnail from a live video + a shared landmark snapshot. */
export function renderBeautyThumbnail(
  source: HTMLVideoElement,
  landmarks: Landmarks | null,
  settings: BeautySettings,
  size = 96,
): string {
  const w = source.videoWidth;
  const h = source.videoHeight;
  if (!w || !h) return "";

  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d");
  if (!sctx) return "";
  drawBeauty(sctx, source, landmarks, w, h, settings);

  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(scratch, sx, sy, side, side, 0, 0, size, size);
  return out.toDataURL("image/jpeg", 0.85);
}
