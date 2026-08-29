import { warmCameraStream, releaseCameraStream, type CameraFacing } from "@/lib/create-camera";

/** Try to open a second facing-mode stream while keeping the first alive. */
export async function openSecondaryCamera(
  facing: CameraFacing,
): Promise<MediaStream | null> {
  try {
    // Prefer video-only for the PiP so we don't fight for the mic twice.
    const stream = await warmCameraStream(facing, { withAudio: false });
    return stream;
  } catch {
    return null;
  }
}

export function releaseSecondaryCamera(stream: MediaStream | null | undefined) {
  releaseCameraStream(stream);
}

/**
 * Composite main + PiP onto a canvas track for publishing (viewers see both cameras).
 * `pipShape`: rectangle or circle. Tap-swap is handled by swapping mainFacing upstream.
 */
export function startDualComposite(
  mainVideo: HTMLVideoElement,
  pipVideo: HTMLVideoElement,
  opts: {
    pipShape: "rectangle" | "circle";
    mainMirrored: boolean;
    pipMirrored: boolean;
    width?: number;
    height?: number;
  },
): { canvas: HTMLCanvasElement; track: MediaStreamTrack; stop: () => void } {
  const width = opts.width ?? 720;
  const height = opts.height ?? 1280;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  let raf = 0;
  let stopped = false;

  const draw = () => {
    if (stopped || !ctx) return;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Main
    ctx.save();
    if (opts.mainMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    drawCover(ctx, mainVideo, 0, 0, width, height);
    ctx.restore();

    // PiP — right side, similar to BIGO
    const pipW = Math.round(width * 0.28);
    const pipH = Math.round(height * 0.22);
    const pipX = width - pipW - Math.round(width * 0.04);
    const pipY = Math.round(height * 0.18);

    ctx.save();
    if (opts.pipShape === "circle") {
      const r = Math.min(pipW, pipH) / 2;
      const cx = pipX + pipW / 2;
      const cy = pipY + pipH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (opts.pipMirrored) {
        ctx.translate(pipX + pipW, pipY);
        ctx.scale(-1, 1);
        drawCover(ctx, pipVideo, 0, 0, pipW, pipH);
      } else {
        drawCover(ctx, pipVideo, pipX, pipY, pipW, pipH);
      }
    } else {
      // rounded rect clip
      roundRect(ctx, pipX, pipY, pipW, pipH, 14);
      ctx.clip();
      if (opts.pipMirrored) {
        ctx.translate(pipX + pipW, pipY);
        ctx.scale(-1, 1);
        drawCover(ctx, pipVideo, 0, 0, pipW, pipH);
      } else {
        drawCover(ctx, pipVideo, pipX, pipY, pipW, pipH);
      }
    }
    ctx.restore();

    // PiP border
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    if (opts.pipShape === "circle") {
      const r = Math.min(pipW, pipH) / 2;
      ctx.beginPath();
      ctx.arc(pipX + pipW / 2, pipY + pipH / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      roundRect(ctx, pipX, pipY, pipW, pipH, 14);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
    raf = requestAnimationFrame(draw);
  };

  raf = requestAnimationFrame(draw);
  const out = canvas.captureStream(30);
  const track = out.getVideoTracks()[0];

  return {
    canvas,
    track,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      track.stop();
      out.getTracks().forEach((t) => t.stop());
    },
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function shareLiveInvite(opts: {
  url: string;
  title?: string;
  circleScoped?: boolean;
}): Promise<"shared" | "copied" | "failed"> {
  const title = opts.title || "Join my live on YAJ";
  const text = opts.circleScoped
    ? `I'm live in my Circle on YAJ — join here:\n${opts.url}`
    : `I'm live on YAJ — watch here:\n${opts.url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url: opts.url });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(opts.url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function liveWatchUrl(opts: { circleId?: string | null; sessionId?: string | null }): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (opts.circleId) return `${origin}/#/circle/c/${opts.circleId}/live`;
  if (opts.sessionId) return `${origin}/#/live/${opts.sessionId}`;
  return `${origin}/#/`;
}
