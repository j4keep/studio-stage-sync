/** Acquire camera during a user tap gesture (required for iOS Safari). */

export type CameraFacing = "user" | "environment";

const PHOTO_JPEG_QUALITY = 0.94;

/** Clean mono mic capture — AGC off to avoid pumped/distorted vocals on mobile. */
const PREFERRED_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: { ideal: 48000 },
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
      audio: PREFERRED_AUDIO,
    },
    {
      video: { facingMode: facing },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
      },
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

/** Monitor mic input level; calls onClip when signal is peaking/clipping. */
export function startMicLevelMonitor(
  stream: MediaStream,
  onLevel: (peak: number) => void,
  onClip: (clipping: boolean) => void,
): () => void {
  const track = stream.getAudioTracks()[0];
  if (!track) return () => {};

  let ctx: AudioContext | null = null;
  let raf = 0;
  let hotFrames = 0;

  try {
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      onLevel(peak);
      if (peak > 0.9) hotFrames = Math.min(hotFrames + 1, 8);
      else hotFrames = Math.max(0, hotFrames - 1);
      onClip(hotFrames >= 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch {
    return () => {};
  }

  return () => {
    cancelAnimationFrame(raf);
    void ctx?.close();
  };
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

export function createVideoRecorder(stream: MediaStream, mimeType: string): MediaRecorder {
  try {
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    return new MediaRecorder(stream);
  }
}
