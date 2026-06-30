/** Acquire camera during a user tap gesture (required for iOS Safari). */

export type CameraFacing = "user" | "environment";

const PHOTO_JPEG_QUALITY = 0.94;

/** Standard video mic — same defaults phones use for camera recording. */
const VIDEO_MIC_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

async function openCameraStream(facing: CameraFacing): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: VIDEO_MIC_AUDIO,
    },
    {
      video: { facingMode: facing },
      audio: VIDEO_MIC_AUDIO,
    },
    {
      video: { facingMode: facing },
      audio: true,
    },
  ];

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      /* try simpler fallback */
    }
  }
  return null;
}

export async function warmCameraStream(facing: CameraFacing = "user"): Promise<MediaStream | null> {
  return openCameraStream(facing);
}

export function releaseCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function captureWithCanvas(video: HTMLVideoElement, mirror: boolean): Promise<Blob | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
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

/** Capture a still from the live preview (matches brightness/exposure you see on screen). */
export async function capturePhotoFromStream(
  _stream: MediaStream,
  video: HTMLVideoElement,
  options: { mirror?: boolean } = {},
): Promise<Blob | null> {
  return captureWithCanvas(video, options.mirror ?? false);
}

function pickSupportedRecorderMimeType(preferred?: string): string | undefined {
  const candidates = [
    preferred,
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/quicktime",
  ].filter(Boolean) as string[];

  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return undefined;
}

export function createVideoRecorder(stream: MediaStream, mimeType = ""): MediaRecorder {
  const supportedMimeType = pickSupportedRecorderMimeType(mimeType);

  const options: MediaRecorderOptions = {
    audioBitsPerSecond: 128_000,
    videoBitsPerSecond: 2_500_000,
  };

  if (supportedMimeType) {
    options.mimeType = supportedMimeType;
  }

  try {
    return new MediaRecorder(stream, options);
  } catch {
    try {
      return supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
    } catch {
      return new MediaRecorder(stream);
    }
  }
}
