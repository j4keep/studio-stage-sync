/** Client-side composite recorder for live battle replays (Zoom/FaceTime 2-up layout). */

import { pickVideoRecorderMimeType } from "@/lib/create-camera";

export type BattleLiveRecorder = {
  stop: () => Promise<Blob | null>;
};

type VideoSource = () => HTMLVideoElement | null;

function loadCover(url?: string | null): HTMLImageElement | null {
  if (!url) return null;
  const img = new Image();
  // Anonymous so canvas captureStream stays untainted when CDN sends CORS.
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.src = url;
  return img;
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  tint: string,
) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, tint);
  g.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${Math.max(28, Math.floor(w * 0.14))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((label || "?").slice(0, 1).toUpperCase(), x + w / 2, y + h / 2);
}

/**
 * Record left/right video elements (+ optional audio streams) into a side-by-side file.
 * Uses getters so video elements can mount after the recorder starts.
 * Falls back to cover art when a camera frame is missing (avoids a black half).
 *
 * Mime / bitrate follow Create→Post camera recording (Apple-safe MP4, no forced
 * bitrates — forced rates were crackling the live capture).
 */
export function startBattleLiveRecorder(opts: {
  getLeftVideo: VideoSource;
  getRightVideo: VideoSource;
  leftCoverUrl?: string | null;
  rightCoverUrl?: string | null;
  leftLabel?: string | null;
  rightLabel?: string | null;
  /** @deprecated prefer getters */
  leftVideoEl?: HTMLVideoElement | null;
  /** @deprecated prefer getters */
  rightVideoEl?: HTMLVideoElement | null;
  leftAudio?: MediaStream | null;
  rightAudio?: MediaStream | null;
}): BattleLiveRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;

  const getLeft = opts.getLeftVideo || (() => opts.leftVideoEl || null);
  const getRight = opts.getRightVideo || (() => opts.rightVideoEl || null);

  const leftCover = loadCover(opts.leftCoverUrl);
  const rightCover = loadCover(opts.rightCoverUrl);

  // Side-by-side Zoom recording frame (matches feed dual 3:4 tiles ≈ 3:2).
  const W = 720;
  const H = 480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const canvasStream = canvas.captureStream(20);
  let audioCtx: AudioContext | null = null;
  const sources: MediaStreamAudioSourceNode[] = [];
  let dest: MediaStreamAudioDestinationNode | null = null;

  try {
    audioCtx = new AudioContext();
    dest = audioCtx.createMediaStreamDestination();
    for (const stream of [opts.leftAudio, opts.rightAudio]) {
      if (!stream?.getAudioTracks().length) continue;
      try {
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(dest);
        sources.push(src);
      } catch {
        /* ignore */
      }
    }
  } catch {
    audioCtx = null;
    dest = null;
  }

  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(dest?.stream.getAudioTracks() || []),
  ]);

  const mime = pickVideoRecorderMimeType();
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    // Same as Create camera: no forced videoBitsPerSecond / audioBitsPerSecond
    // (forced rates crackle on iOS Safari).
    recorder = mime
      ? new MediaRecorder(mixed, { mimeType: mime })
      : new MediaRecorder(mixed);
  } catch {
    try {
      recorder = new MediaRecorder(mixed);
    } catch {
      void audioCtx?.close();
      return null;
    }
  }

  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };

  try {
    recorder.start(1000);
  } catch {
    void audioCtx?.close();
    return null;
  }

  const drawImageFit = (
    source: CanvasImageSource,
    sw: number,
    sh: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!sw || !sh) return;
    const vr = sw / sh;
    const cr = w / h;
    let sx = 0;
    let sy = 0;
    let sww = sw;
    let shh = sh;
    if (vr > cr) {
      sww = sh * cr;
      sx = (sw - sww) / 2;
    } else {
      shh = sw / cr;
      sy = (sh - shh) / 2;
    }
    try {
      ctx.drawImage(source, sx, sy, sww, shh, x, y, w, h);
    } catch {
      /* ignore */
    }
  };

  const drawSide = (
    v: HTMLVideoElement | null,
    cover: HTMLImageElement | null,
    label: string,
    tint: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x, y, w, h);
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      drawImageFit(v, v.videoWidth, v.videoHeight, x, y, w, h);
      return;
    }
    if (cover && cover.complete && cover.naturalWidth > 0) {
      try {
        drawImageFit(cover, cover.naturalWidth, cover.naturalHeight, x, y, w, h);
        return;
      } catch {
        /* tainted / incomplete — fall through to placeholder */
      }
    }
    drawPlaceholder(ctx, x, y, w, h, label, tint);
  };

  let raf = 0;
  const tick = () => {
    drawSide(getLeft(), leftCover, opts.leftLabel || "L", "#0e7490", 0, 0, W / 2, H);
    drawSide(getRight(), rightCover, opts.rightLabel || "R", "#9d174d", W / 2, 0, W / 2, H);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () =>
      new Promise((resolve) => {
        cancelAnimationFrame(raf);
        const finish = () => {
          sources.forEach((s) => {
            try {
              s.disconnect();
            } catch {
              /* ignore */
            }
          });
          void audioCtx?.close();
          canvasStream.getTracks().forEach((t) => t.stop());
          if (!chunks.length) {
            resolve(null);
            return;
          }
          resolve(new Blob(chunks, { type: recorder.mimeType || mime || "video/webm" }));
        };
        if (recorder.state === "inactive") {
          finish();
          return;
        }
        recorder.onstop = finish;
        try {
          if (recorder.state === "recording") recorder.requestData();
          recorder.stop();
        } catch {
          finish();
        }
      }),
  };
}
