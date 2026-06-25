/** Acquire camera during a user tap gesture (required for iOS Safari). */

export type CameraFacing = "user" | "environment";

const PHOTO_JPEG_QUALITY = 0.97;

const VIDEO_CONSTRAINT_TIERS: MediaTrackConstraints[] = [
  {
    facingMode: { ideal: "user" },
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 60 },
  },
  {
    facingMode: { ideal: "user" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  {
    facingMode: { ideal: "user" },
  },
];

async function tryGetUserMedia(
  facing: CameraFacing,
  tiers: MediaTrackConstraints[],
): Promise<MediaStream | null> {
  for (const tier of tiers) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { ...tier, facingMode: { ideal: facing } },
        audio: true,
      });
    } catch {
      /* try next tier */
    }
  }
  return null;
}

/** Push the video track to the highest resolution the device reports. */
export async function upgradeVideoTrackResolution(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities || !track.applyConstraints) return;

  const caps = track.getCapabilities();
  const maxW = caps.width?.max;
  const maxH = caps.height?.max;
  if (!maxW || !maxH) return;

  try {
    await track.applyConstraints({
      width: { ideal: maxW },
      height: { ideal: maxH },
    });
  } catch {
    /* keep negotiated resolution */
  }
}

export async function warmCameraStream(facing: CameraFacing = "user"): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await tryGetUserMedia(facing, VIDEO_CONSTRAINT_TIERS);
  if (!stream) return null;
  await upgradeVideoTrackResolution(stream);
  return stream;
}

export function releaseCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function mirrorJpegBlob(blob: Blob, quality = PHOTO_JPEG_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Mirror export failed"))), "image/jpeg", quality);
  });
}

async function captureWithImageCapture(
  track: MediaStreamTrack,
  mirror: boolean,
): Promise<Blob | null> {
  if (typeof ImageCapture === "undefined") return null;

  try {
    const ic = new ImageCapture(track);
    const photoCaps = await ic.getPhotoCapabilities?.();
    const settings: PhotoSettings = {};
    if (photoCaps?.imageWidth?.max) settings.imageWidth = photoCaps.imageWidth.max;
    if (photoCaps?.imageHeight?.max) settings.imageHeight = photoCaps.imageHeight.max;

    let blob = await ic.takePhoto(Object.keys(settings).length ? settings : undefined);
    if (mirror) blob = await mirrorJpegBlob(blob);
    return blob;
  } catch {
    return null;
  }
}

async function captureWithCanvas(video: HTMLVideoElement, mirror: boolean): Promise<Blob | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("loadeddata", done);
        resolve();
      };
      video.addEventListener("loadeddata", done);
    });
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", PHOTO_JPEG_QUALITY);
  });
}

/** Capture the highest-quality still photo from an active camera stream. */
export async function capturePhotoFromStream(
  stream: MediaStream,
  video: HTMLVideoElement,
  options: { mirror?: boolean } = {},
): Promise<Blob | null> {
  const track = stream.getVideoTracks()[0];
  if (!track) return null;

  const mirror = options.mirror ?? false;
  const fromStill = await captureWithImageCapture(track, mirror);
  if (fromStill) return fromStill;

  return captureWithCanvas(video, mirror);
}

/** High bitrate for clearer in-app video recordings. */
export function createVideoRecorder(stream: MediaStream, mimeType: string): MediaRecorder {
  const bitsPerSecond = 8_000_000;
  const opts = mimeType ? { mimeType, videoBitsPerSecond: bitsPerSecond } : { videoBitsPerSecond: bitsPerSecond };
  try {
    return new MediaRecorder(stream, opts);
  } catch {
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  }
}
