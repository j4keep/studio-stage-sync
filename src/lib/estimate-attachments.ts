/** Prepare bounded photo/video stills for an AI repair estimate.
 * Video is sampled as images; no claim of complete frame-by-frame inspection.
 */
export async function estimateMediaFrames(file: File): Promise<string[]> {
  if (file.size > 40 * 1024 * 1024) throw new Error("File too large (40 MB maximum)");
  if (file.type.startsWith("image/")) {
    return [await encodeImage(file)];
  }
  if (!file.type.startsWith("video/")) throw new Error("Choose a photo or video");
  return framesFromVideo(file);
}

async function encodeImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    image.close();
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Could not read video frame")); }, 12000);
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video format not supported")); };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
    };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.currentTime = time;
  });
}

async function framesFromVideo(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Video loading timed out")); }, 12000);
      const ready = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error("Unsupported video format")); };
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", ready);
        video.removeEventListener("error", fail);
      };
      video.addEventListener("loadedmetadata", ready, { once: true });
      video.addEventListener("error", fail, { once: true });
      video.load();
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 90)
      throw new Error("Use a video no longer than 90 seconds");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const result: string[] = [];
    for (const fraction of [0.15, 0.5, 0.85]) {
      await seek(video, Math.min(video.duration - 0.05, Math.max(0, video.duration * fraction)));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      result.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return result;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
