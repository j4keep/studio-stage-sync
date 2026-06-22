const SEEK_TIMEOUT_MS = 2500;

function waitForEvent(target: EventTarget, event: string, timeoutMs = SEEK_TIMEOUT_MS) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      target.removeEventListener(event, finish);
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    target.addEventListener(event, finish, { once: true });
  });
}

async function waitForVideoFrame(video: HTMLVideoElement) {
  const requestFrame = video.requestVideoFrameCallback?.bind(video);
  if (!requestFrame) return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 350);
    requestFrame(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
}

function frameBrightness(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sample = ctx.getImageData(0, 0, Math.max(1, width), Math.max(1, height)).data;
  let total = 0;
  for (let i = 0; i < sample.length; i += 4) {
    total += (sample[i] + sample[i + 1] + sample[i + 2]) / 3;
  }
  return total / (sample.length / 4 || 1);
}

export async function captureVideoPoster(src: string, options: { mime?: string; quality?: number } = {}): Promise<string | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  await waitForEvent(video, "loadedmetadata");
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
  const targets = Array.from(new Set([
    0.25,
    0.6,
    1.1,
    2,
    Math.min(duration - 0.05, Math.max(0.1, duration * 0.12)),
    Math.min(duration - 0.05, Math.max(0.1, duration * 0.25)),
  ].filter((t) => t >= 0 && t < duration)));

  const canvas = document.createElement("canvas");
  let best: { dataUrl: string; brightness: number } | null = null;

  for (const t of targets) {
    try {
      video.currentTime = t;
      await waitForEvent(video, "seeked");
      await waitForVideoFrame(video);
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(video, 0, 0, width, height);
      const brightness = frameBrightness(ctx, Math.min(width, 64), Math.min(height, 64));
      const dataUrl = canvas.toDataURL(options.mime || "image/jpeg", options.quality ?? 0.82);
      if (!best || brightness > best.brightness) best = { dataUrl, brightness };
      if (brightness > 14) break;
    } catch {
      continue;
    }
  }

  video.removeAttribute("src");
  video.load();
  return best?.dataUrl ?? null;
}

export async function captureVideoPosterFromBlob(blob: Blob): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  try {
    return await captureVideoPoster(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}