import yajLogoUrl from "@/assets/yaj-logo.png";

async function resolveMediaObjectUrl(src: string): Promise<{ url: string; revoke: () => void }> {
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  } catch {
    return { url: src, revoke: () => {} };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  canvasW: number,
  canvasH: number,
) {
  const maxW = Math.max(56, Math.min(canvasW, canvasH) * 0.16);
  const scale = maxW / logo.naturalWidth;
  const w = logo.naturalWidth * scale;
  const h = logo.naturalHeight * scale;
  const pad = Math.max(14, Math.min(canvasW, canvasH) * 0.035);
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.drawImage(logo, canvasW - w - pad, pad, w, h);
  ctx.restore();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export media"))),
      type,
      quality,
    );
  });
}

async function downloadImageWithLogo(mediaUrl: string, logo: HTMLImageElement, base: string) {
  const resolved = await resolveMediaObjectUrl(mediaUrl);
  try {
    const img = await loadImage(resolved.url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0);
    drawLogo(ctx, logo, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/png");
    triggerDownload(blob, `${base}.png`);
  } finally {
    resolved.revoke();
  }
}

async function downloadVideoFrameWithLogo(mediaUrl: string, logo: HTMLImageElement, base: string) {
  const resolved = await resolveMediaObjectUrl(mediaUrl);
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.preload = "auto";
  video.src = resolved.url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("Failed to load video")), { once: true });
    });

    try {
      await video.play();
      video.pause();
    } catch {
      /* seek still works if autoplay blocked */
    }

    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        video.currentTime = Math.min(0.1, video.duration || 0.1);
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawLogo(ctx, logo, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, "image/png");
    triggerDownload(blob, `${base}.png`);
  } finally {
    video.removeAttribute("src");
    video.load();
    resolved.revoke();
  }
}

async function downloadVideoWithLogo(mediaUrl: string, logo: HTMLImageElement, base: string) {
  const resolved = await resolveMediaObjectUrl(mediaUrl);
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.preload = "auto";
  video.src = resolved.url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("Failed to load video")), { once: true });
    });

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    const canvasStream = canvas.captureStream(30);
    let audioCtx: AudioContext | null = null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        dest.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        video.muted = false;
      }
    } catch {
      /* keep muted canvas-only export */
    }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";

    if (!mime || typeof MediaRecorder === "undefined") {
      resolved.revoke();
      await downloadVideoFrameWithLogo(mediaUrl, logo, base);
      return;
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(canvasStream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      recorder.onerror = () => reject(new Error("Recording failed"));
    });

    let raf = 0;
    const paint = () => {
      ctx.drawImage(video, 0, 0, width, height);
      drawLogo(ctx, logo, width, height);
      raf = requestAnimationFrame(paint);
    };

    video.currentTime = 0;
    recorder.start(250);
    paint();
    try {
      await video.play();
    } catch {
      cancelAnimationFrame(raf);
      recorder.stop();
      await audioCtx?.close().catch(() => {});
      resolved.revoke();
      await downloadVideoFrameWithLogo(mediaUrl, logo, base);
      return;
    }

    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      video.addEventListener("ended", finish, { once: true });
      // Cap very long videos so download stays responsive
      const maxMs = Math.min((video.duration || 30) * 1000, 90_000);
      window.setTimeout(finish, maxMs + 400);
    });

    video.pause();
    cancelAnimationFrame(raf);
    if (recorder.state !== "inactive") recorder.stop();

    const blob = await stopped;
    await audioCtx?.close().catch(() => {});

    if (blob.size < 1024) {
      resolved.revoke();
      await downloadVideoFrameWithLogo(mediaUrl, logo, base);
      return;
    }

    triggerDownload(blob, `${base}.webm`);
  } finally {
    video.removeAttribute("src");
    video.load();
    resolved.revoke();
  }
}

/** Download image/video with the YAJ logo stamped top-right. */
export async function downloadMediaWithYajLogo(opts: {
  mediaUrl: string;
  mediaType?: string | null;
  filenameBase?: string;
}): Promise<void> {
  if (!opts.mediaUrl) throw new Error("No media to download");
  const logo = await loadImage(yajLogoUrl);
  const base = opts.filenameBase || `yaj-${Date.now()}`;
  const isVideo = (opts.mediaType || "").toLowerCase() === "video";

  if (isVideo) {
    try {
      await downloadVideoWithLogo(opts.mediaUrl, logo, base);
    } catch {
      await downloadVideoFrameWithLogo(opts.mediaUrl, logo, base);
    }
    return;
  }

  await downloadImageWithLogo(opts.mediaUrl, logo, base);
}
