/** Client-side composite recorder for live battle replays (2-up FaceTime layout). */

function pickMime(): string {
  const opts = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "video/webm";
}

export type BattleLiveRecorder = {
  stop: () => Promise<Blob | null>;
};

/**
 * Record left/right video elements (+ optional audio streams) into a side-by-side WebM.
 * Best-effort: challenger runs this while the debate is live.
 */
export function startBattleLiveRecorder(opts: {
  leftVideoEl: HTMLVideoElement | null;
  rightVideoEl: HTMLVideoElement | null;
  leftAudio?: MediaStream | null;
  rightAudio?: MediaStream | null;
}): BattleLiveRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;

  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const canvasStream = canvas.captureStream(24);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const sources: MediaStreamAudioSourceNode[] = [];

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

  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mime = pickMime();
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(mixed, {
      mimeType: mime,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 128_000,
    });
  } catch {
    void audioCtx.close();
    return null;
  }

  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  recorder.start(1000);

  const drawCover = (
    v: HTMLVideoElement | null,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x, y, w, h);
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    const vr = v.videoWidth / v.videoHeight;
    const cr = w / h;
    let sx = 0;
    let sy = 0;
    let sw = v.videoWidth;
    let sh = v.videoHeight;
    if (vr > cr) {
      sw = v.videoHeight * cr;
      sx = (v.videoWidth - sw) / 2;
    } else {
      sh = v.videoWidth / cr;
      sy = (v.videoHeight - sh) / 2;
    }
    ctx.drawImage(v, sx, sy, sw, sh, x, y, w, h);
  };

  let raf = 0;
  const tick = () => {
    drawCover(opts.leftVideoEl, 0, 0, W / 2, H);
    drawCover(opts.rightVideoEl, W / 2, 0, W / 2, H);
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
          void audioCtx.close();
          canvasStream.getTracks().forEach((t) => t.stop());
          if (!chunks.length) {
            resolve(null);
            return;
          }
          resolve(new Blob(chunks, { type: mime }));
        };
        if (recorder.state === "inactive") {
          finish();
          return;
        }
        recorder.onstop = finish;
        try {
          recorder.stop();
        } catch {
          finish();
        }
      }),
  };
}
