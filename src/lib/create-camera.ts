/** Acquire camera during a user tap gesture (required for iOS Safari). */

export type CameraFacing = "user" | "environment";

const PHOTO_JPEG_QUALITY = 0.94;

async function openCameraStream(facing: CameraFacing): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  // Raw "camcorder" mic: disable echo cancellation, noise suppression, and
  // auto-gain so the mic captures the actual room — your voice AND any music
  // playing from the speaker — at real loudness. Defaults (`audio: true`) turn
  // those filters ON, which makes iOS subtract speaker audio as "echo" and is
  // why background music sounded almost silent in playback.
  const rawMicAudio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: rawMicAudio,
    },
    { video: { facingMode: facing }, audio: rawMicAudio },
    { video: { facingMode: facing }, audio: true },
  ];

  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream.getAudioTracks().length > 0) return stream;
      stream.getTracks().forEach((t) => t.stop());
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

export function streamHasLiveAudio(stream: MediaStream | null | undefined): boolean {
  return (
    !!stream &&
    stream.getAudioTracks().some((t) => t.readyState === "live" && t.enabled)
  );
}

/** Clone active tracks into a fresh stream for MediaRecorder. */
export function cloneStreamForRecording(stream: MediaStream): MediaStream {
  return new MediaStream([...stream.getVideoTracks(), ...stream.getAudioTracks()]);
}

function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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

/** Prefer codecs that reliably mux microphone audio with video. */
export function pickVideoRecorderMimeType(): string {
  const candidates = isAppleMobile()
    ? ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    : [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];

  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

export function createVideoRecorder(stream: MediaStream, mimeType = ""): MediaRecorder {
  const supportedMimeType = mimeType || pickVideoRecorderMimeType();

  // No explicit bitrates — let the browser pick its native defaults, the same
  // way a phone's stock camera app records. Forcing audio/video bitrates on
  // iOS Safari produces distorted, crackling output.
  const attempts: MediaRecorderOptions[] = [];

  if (supportedMimeType) {
    attempts.push({ mimeType: supportedMimeType });
  }

  attempts.push({});

  for (const options of attempts) {
    try {
      return new MediaRecorder(stream, options);
    } catch {
      continue;
    }
  }

  return new MediaRecorder(stream);
}

export function fileExtensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("quicktime")) return "mp4";
  return "webm";
}
