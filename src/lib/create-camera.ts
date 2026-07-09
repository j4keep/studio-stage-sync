/** Acquire camera with the device factory mic settings (browser defaults). */

export type CameraFacing = "user" | "environment";

const PHOTO_JPEG_QUALITY = 0.94;
const SOCIAL_AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};
async function openCameraStream(
  facing: CameraFacing,
  withAudio: boolean,
): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const attempts: MediaStreamConstraints[] = withAudio
    ? [
        {
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: SOCIAL_AUDIO,
        },
        { video: { facingMode: facing }, audio: SOCIAL_AUDIO },
      ]
    : [
        {
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        },
        { video: { facingMode: facing } },
      ];

  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (streamHasLiveVideo(stream)) return stream;
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* try simpler fallback */
    }
  }
  return null;
}

export async function warmCameraStream(
  facing: CameraFacing = "user",
  options: { withAudio?: boolean } = {},
): Promise<MediaStream | null> {
  const withAudio = options.withAudio !== false;
  return openCameraStream(facing, withAudio);
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

export function streamHasLiveVideo(stream: MediaStream | null | undefined): boolean {
  return (
    !!stream &&
    stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled)
  );
}

/** Clone active tracks into a fresh stream for MediaRecorder. */
export function cloneStreamForRecording(stream: MediaStream): MediaStream {
  return new MediaStream([...stream.getVideoTracks(), ...stream.getAudioTracks()]);
}

/** Lip-sync posts: record picture only — added song is mixed in at edit/feed time. */
export function videoOnlyRecordStream(stream: MediaStream): MediaStream {
  return new MediaStream(stream.getVideoTracks());
}

/** Stop mic hardware so iOS won't duck speaker playback during lip-sync. */
export function stripStreamAudio(stream: MediaStream): void {
  for (const track of [...stream.getAudioTracks()]) {
    track.stop();
    stream.removeTrack(track);
  }
}

/** Add a mic track without restarting the camera preview (avoids black screen on mobile). */
export async function ensureStreamHasAudio(
  stream: MediaStream,
): Promise<boolean> {
  if (streamHasLiveAudio(stream)) return true;

  for (const audioConstraints of [true] as const) {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: SOCIAL_AUDIO });
      const track = audioStream.getAudioTracks()[0];
      if (track) {
        stream.addTrack(track);
        return true;
      }
      audioStream.getTracks().forEach((t) => t.stop());
    } catch {
      /* try fallback */
    }
  }

  return streamHasLiveAudio(stream);
}

export type MirroredRecordStream = {
  stream: MediaStream;
  stop: () => void;
};

/**
 * Record through a canvas when the live preview is CSS-mirrored (front camera)
 * so the saved file matches what the user saw.
 */
export function createMirroredVideoRecordStream(
  sourceStream: MediaStream,
  video: HTMLVideoElement,
  mirror: boolean,
): MirroredRecordStream {
  if (!mirror) {
    return { stream: cloneStreamForRecording(sourceStream), stop: () => {} };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { stream: cloneStreamForRecording(sourceStream), stop: () => {} };
  }

  let rafId = 0;
  let stopped = false;

  const syncCanvasSize = () => {
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const drawFrame = () => {
    if (stopped) return;
    syncCanvasSize();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && canvas.width && canvas.height) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    rafId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const canvasStream = canvas.captureStream(30);
  sourceStream.getAudioTracks().forEach((track) => {
    canvasStream.addTrack(track);
  });

  return {
    stream: canvasStream,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      canvasStream.getVideoTracks().forEach((t) => t.stop());
    },
  };
}

function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAppleMobileDevice(): boolean {
  return isAppleMobile();
}

/** iOS Safari muxes long clips more reliably without periodic timeslices. */
export function videoRecorderTimesliceMs(): number | undefined {
  return isAppleMobile() ? undefined : 100;
}

/** Wait for requestData() flush, then stop — avoids truncated last seconds on iOS. */
export function stopVideoRecorderWithFinalChunk(
  recorder: MediaRecorder,
  timeoutMs = 350,
): Promise<void> {
  if (recorder.state !== "recording") return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finishWait = () => {
      if (settled) return;
      settled = true;
      recorder.removeEventListener("dataavailable", onFinalChunk);
      window.clearTimeout(fallback);
      resolve();
    };

    const onFinalChunk = () => finishWait();
    recorder.addEventListener("dataavailable", onFinalChunk, { once: true });
    const fallback = window.setTimeout(finishWait, timeoutMs);

    try {
      recorder.requestData();
    } catch {
      finishWait();
    }
  }).then(() => {
    if (recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  });
}

function isMobileDevice(): boolean {
  return isAppleMobile() || /Android/i.test(navigator.userAgent);
}

/** Front-camera preview is CSS-mirrored; desktop record output needs the same flip. */
export function shouldMirrorRecordOutput(facing: CameraFacing): boolean {
  return facing === "user" && !isMobileDevice();
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
