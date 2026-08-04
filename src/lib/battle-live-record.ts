/** Client-side composite recorder for live battle replays (Zoom/FaceTime 2-up layout). */

import { pickVideoRecorderMimeType } from "@/lib/create-camera";

export type BattleLiveRecorderSources = {
  /** Preferred: LiveKit camera/screen streams (survives tile remounts). */
  getLeftStream?: () => MediaStream | null;
  getRightStream?: () => MediaStream | null;
  /** Fallback: visible FaceTime <video> elements. */
  getLeftVideo?: () => HTMLVideoElement | null;
  getRightVideo?: () => HTMLVideoElement | null;
  leftAudio?: MediaStream | null;
  rightAudio?: MediaStream | null;
};

export type BattleLiveRecorder = {
  stop: () => Promise<Blob | null>;
  /** Rebind stream/video getters after feed ↔ battle remounts. */
  setSources: (sources: BattleLiveRecorderSources) => void;
};

type VideoSource = () => HTMLVideoElement | null;
type StreamSource = () => MediaStream | null;

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

/** Tiny always-on sink so iOS will decode WebRTC frames for canvas capture. */
function createRecordSink(label: string): HTMLVideoElement {
  const el = document.createElement("video");
  el.setAttribute("data-battle-record-sink", label);
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.muted = true;
  el.defaultMuted = true;
  el.autoplay = true;
  el.playsInline = true;
  el.loop = false;
  // Must stay in the document and not display:none — iOS skips decode otherwise.
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "2px",
    height: "2px",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
    transform: "translateZ(0)",
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  return el;
}

function releaseSinkStream(sink: HTMLVideoElement) {
  const prev = sink.srcObject as MediaStream | null;
  // Only stop clones — never stop a shared live FaceTime track.
  if (sink.dataset.cloned === "1" && prev) {
    try {
      prev.getTracks?.().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }
  sink.srcObject = null;
  delete sink.dataset.boundTrackId;
  delete sink.dataset.cloned;
}

function bindSinkToStream(sink: HTMLVideoElement, stream: MediaStream | null) {
  const nextTrack = stream?.getVideoTracks?.()[0] || null;
  // Identity key on the SOURCE track id so we don't re-clone every frame.
  const nextId = nextTrack?.id || "";
  const boundId = sink.dataset.boundTrackId || "";
  if (nextId !== boundId) {
    releaseSinkStream(sink);
    if (nextTrack) {
      try {
        const cloned = nextTrack.clone();
        sink.srcObject = new MediaStream([cloned]);
        sink.dataset.boundTrackId = nextId;
        sink.dataset.cloned = "1";
      } catch {
        // clone() unavailable — share the stream (may contend with the preview).
        sink.srcObject = stream;
        sink.dataset.boundTrackId = nextId;
        delete sink.dataset.cloned;
      }
    }
  }
  if (sink.srcObject) {
    sink.muted = true;
    void sink.play().catch(() => undefined);
  }
}

function videoHasFrame(v: HTMLVideoElement | null | undefined): v is HTMLVideoElement {
  return !!v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0;
}

/**
 * Record left/right video into a side-by-side file.
 * Prefers durable MediaStream sinks (survives BattleLiveStage remount when the
 * challenger is redirected from prep → Posts). Falls back to cover art only
 * until a live camera/screen frame arrives — never swaps back to covers after.
 */
export function startBattleLiveRecorder(opts: {
  getLeftStream?: StreamSource;
  getRightStream?: StreamSource;
  getLeftVideo?: VideoSource;
  getRightVideo?: VideoSource;
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
  if (typeof MediaRecorder === "undefined" || typeof document === "undefined") return null;

  let getLeftStream: StreamSource = opts.getLeftStream || (() => null);
  let getRightStream: StreamSource = opts.getRightStream || (() => null);
  let getLeftVideo: VideoSource = opts.getLeftVideo || (() => opts.leftVideoEl || null);
  let getRightVideo: VideoSource = opts.getRightVideo || (() => opts.rightVideoEl || null);

  const leftCover = loadCover(opts.leftCoverUrl);
  const rightCover = loadCover(opts.rightCoverUrl);

  const leftSink = createRecordSink("left");
  const rightSink = createRecordSink("right");

  // Side-by-side Zoom recording frame (matches feed dual 3:4 tiles ≈ 3:2).
  const W = 720;
  const H = 480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    leftSink.remove();
    rightSink.remove();
    return null;
  }

  const canvasStream = canvas.captureStream(20);
  let audioCtx: AudioContext | null = null;
  const sources: MediaStreamAudioSourceNode[] = [];
  let dest: MediaStreamAudioDestinationNode | null = null;

  const wireAudio = (leftAudio?: MediaStream | null, rightAudio?: MediaStream | null) => {
    sources.forEach((s) => {
      try {
        s.disconnect();
      } catch {
        /* ignore */
      }
    });
    sources.length = 0;
    if (!audioCtx || !dest) return;
    for (const stream of [leftAudio, rightAudio]) {
      if (!stream?.getAudioTracks().length) continue;
      try {
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(dest);
        sources.push(src);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    audioCtx = new AudioContext();
    dest = audioCtx.createMediaStreamDestination();
    wireAudio(opts.leftAudio, opts.rightAudio);
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
    recorder = mime ? new MediaRecorder(mixed, { mimeType: mime }) : new MediaRecorder(mixed);
  } catch {
    try {
      recorder = new MediaRecorder(mixed);
    } catch {
      void audioCtx?.close();
      leftSink.remove();
      rightSink.remove();
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
    leftSink.remove();
    rightSink.remove();
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

  let leftHadLiveFrame = false;
  let rightHadLiveFrame = false;

  const pickFrame = (
    sink: HTMLVideoElement,
    uiVideo: HTMLVideoElement | null,
  ): HTMLVideoElement | null => {
    if (videoHasFrame(sink)) return sink;
    if (videoHasFrame(uiVideo)) return uiVideo;
    return null;
  };

  const drawSide = (
    frame: HTMLVideoElement | null,
    cover: HTMLImageElement | null,
    label: string,
    tint: string,
    hadLive: boolean,
    markLive: () => void,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (frame) {
      if (!hadLive) {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(x, y, w, h);
      }
      drawImageFit(frame, frame.videoWidth, frame.videoHeight, x, y, w, h);
      markLive();
      return;
    }

    // Once we've captured real camera/screen frames, keep the last canvas pixels
    // instead of baking static cover photos over the rest of the debate.
    if (hadLive) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x, y, w, h);
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
    bindSinkToStream(leftSink, getLeftStream());
    bindSinkToStream(rightSink, getRightStream());

    const leftFrame = pickFrame(leftSink, getLeftVideo());
    const rightFrame = pickFrame(rightSink, getRightVideo());

    drawSide(
      leftFrame,
      leftCover,
      opts.leftLabel || "L",
      "#0e7490",
      leftHadLiveFrame,
      () => {
        leftHadLiveFrame = true;
      },
      0,
      0,
      W / 2,
      H,
    );
    drawSide(
      rightFrame,
      rightCover,
      opts.rightLabel || "R",
      "#9d174d",
      rightHadLiveFrame,
      () => {
        rightHadLiveFrame = true;
      },
      W / 2,
      0,
      W / 2,
      H,
    );
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const cleanupSinks = () => {
    try {
      leftSink.pause();
      releaseSinkStream(leftSink);
      leftSink.remove();
    } catch {
      /* ignore */
    }
    try {
      rightSink.pause();
      releaseSinkStream(rightSink);
      rightSink.remove();
    } catch {
      /* ignore */
    }
  };

  return {
    setSources: (next) => {
      if (next.getLeftStream) getLeftStream = next.getLeftStream;
      if (next.getRightStream) getRightStream = next.getRightStream;
      if (next.getLeftVideo) getLeftVideo = next.getLeftVideo;
      if (next.getRightVideo) getRightVideo = next.getRightVideo;
      if (next.leftAudio !== undefined || next.rightAudio !== undefined) {
        wireAudio(next.leftAudio ?? null, next.rightAudio ?? null);
      }
      bindSinkToStream(leftSink, getLeftStream());
      bindSinkToStream(rightSink, getRightStream());
    },
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
          cleanupSinks();
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
