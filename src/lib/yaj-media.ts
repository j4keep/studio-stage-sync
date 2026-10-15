import { speakableYajText } from "@/lib/yaj-pronounce";
import { supabase } from "@/integrations/supabase/client";

const FN = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

async function yajAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function postJson<T>(name: string, body: unknown): Promise<T> {
  const resp = await fetch(FN(name), {
    method: "POST",
    headers: await yajAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data as T;
}

/** Generate an image with YAJ. Returns a data URL (or hosted URL). */
export async function generateYajImage(prompt: string): Promise<string> {
  const { image } = await postJson<{ image: string }>("yaj-image", { prompt });
  return image;
}

/** Turn text into natural spoken audio. Returns a playable data URL. */
export async function synthesizeYajVoice(text: string, voice?: string): Promise<string> {
  const spoken = speakableYajText(text);
  const { audio } = await postJson<{ audio: string }>("yaj-voice", { text: spoken, voice });
  return audio;
}

/** Transcribe a recorded clip into text. */
export async function transcribeYajAudio(dataUrl: string): Promise<string> {
  const { text } = await postJson<{ text: string }>("yaj-transcribe", { audio: dataUrl });
  return text;
}

/** Heuristic: does this message ask YAJ to make a picture? */
export function looksLikeImageRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (!/(image|picture|photo|artwork|art of|illustration|drawing|logo|poster|cover art|wallpaper|thumbnail|graphic)/.test(t)) {
    return false;
  }
  return /(generate|create|make|draw|design|paint|render|show me|give me|i want|can you)/.test(t);
}

// ---------------------------------------------------------------------------
// Microphone recording → complete WAV file (works on iOS Safari & Chrome)
// ---------------------------------------------------------------------------

let sharedAudio: HTMLAudioElement | null = null;

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }

  const targetRate = 16000;
  const ratio = sampleRate / targetRate;
  const outLength = ratio > 1 ? Math.floor(samples.length / ratio) : samples.length;
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    out[i] = samples[Math.floor(i * (ratio > 1 ? ratio : 1))] ?? 0;
  }
  const rate = ratio > 1 ? targetRate : sampleRate;

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.length * 2, true);
  let p = 44;
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export type MicRecorder = { stop: () => Promise<string | null>; cancel: () => void };

export type MicOptions = {
  /** Called once when the speaker has clearly stopped talking. */
  onSilence?: () => void;
  /** How long of a quiet gap counts as "done talking" (ms). */
  silenceMs?: number;
  /** Live 0..1 loudness, for visualizers. */
  onLevel?: (level: number) => void;
  /** Reuse a stream acquired during a user gesture (required on some iOS builds). */
  existingStream?: MediaStream | null;
};

/** Human-readable mic failure — only call it "blocked" for real permission denials. */
export function describeMicError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
  const msg = err instanceof Error ? err.message : "";

  if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(msg)) {
    return "Microphone permission was denied. Enable it for this site in your browser settings, then tap Try again.";
  }
  if (name === "NotFoundError" || /not found|no device/i.test(msg)) {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError" || /in use|readable|track/i.test(msg)) {
    return "Your microphone is busy in another app or tab. Close it, then tap Try again.";
  }
  if (name === "OverconstrainedError") {
    return "Couldn't match this device's microphone settings. Tap Try again.";
  }
  if (name === "SecurityError") {
    return "Microphone needs a secure (HTTPS) connection.";
  }
  if (/AudioSession|audio session|not compatible with audio capture/i.test(msg)) {
    return "This in-app browser cannot start microphone capture with its current iPhone audio session. Open YAJ directly in Safari and try again.";
  }
  if (/AudioContext|audio context/i.test(msg)) {
    return "Couldn't start audio capture. Try opening YAJ directly in Safari.";
  }
  return msg || "Couldn't start the microphone. Tap Try again.";
}

type IosAudioSession = { type: string };
function setIosAudioSession(type: "play-and-record" | "playback" | "auto") {
  const session = (navigator as Navigator & { audioSession?: IosAudioSession }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    /* not writable on this browser */
  }
}

/** True when this browser can capture the mic at all. */
export function canUseLiveMic(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Open the mic during a click/tap so permission stays tied to a user gesture. */
export async function acquireMicStream(): Promise<MediaStream> {
  if (!canUseLiveMic()) throw new Error("Live microphone isn't supported in this browser.");
  // iOS: release any playback-only session from YAJ speech BEFORE capture starts,
  // otherwise WebKit throws "AudioSession category is not compatible with audio capture".
  sharedAudio?.pause();
  setIosAudioSession("play-and-record");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    if (err instanceof Error && /AudioSession|not compatible with audio capture/i.test(err.message)) {
      // Retry once with a plain constraint after resetting the session.
      setIosAudioSession("auto");
      await new Promise((r) => setTimeout(r, 150));
      setIosAudioSession("play-and-record");
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    throw err;
  }
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

/** Start recording the mic. Resolves with a recorder whose stop() returns an audio data URL. */
export async function startMicRecording(options: MicOptions = {}): Promise<MicRecorder> {
  const { onSilence, silenceMs = 1300, onLevel, existingStream } = options;

  const stream =
    existingStream && existingStream.active && existingStream.getAudioTracks().some((t) => t.readyState === "live")
      ? existingStream
      : await acquireMicStream();

  // Optional level/silence meter. If iOS refuses an AudioContext, recording still works.
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let node: ScriptProcessorNode | null = null;
  let mute: GainNode | null = null;
  const pcm: Float32Array[] = [];
  try {
    const AudioCtx: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? window.AudioContext;
    ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    source = ctx.createMediaStreamSource(stream);
    mute = ctx.createGain();
    mute.gain.value = 0;
    node = ctx.createScriptProcessor(4096, 1, 1);
    let heardSpeech = false;
    let quietSince = 0;
    let silenceFired = false;
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      if (!recorder) pcm.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      onLevel?.(Math.min(1, rms * 8));
      const now = performance.now();
      if (rms > 0.02) {
        heardSpeech = true;
        quietSince = 0;
      } else if (heardSpeech) {
        if (!quietSince) quietSince = now;
        else if (!silenceFired && now - quietSince > silenceMs) {
          silenceFired = true;
          onSilence?.();
        }
      }
    };
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  } catch (err) {
    console.warn("YAJ mic meter unavailable, recording without it", err);
    ctx?.close().catch(() => undefined);
    ctx = null;
    node = null;
  }

  // Preferred capture: MediaRecorder (native on iOS 14.3+, Chrome, Firefox).
  const mime = pickRecorderMime();
  let recorder: MediaRecorder | null = null;
  const blobs: Blob[] = [];
  if (mime !== undefined) {
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) blobs.push(e.data); };
      recorder.start(250);
    } catch (err) {
      console.warn("MediaRecorder failed, using PCM capture", err);
      recorder = null;
    }
  }
  if (!recorder && !node) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Couldn't start audio capture in this browser.");
  }

  const teardown = () => {
    if (node) node.onaudioprocess = null;
    for (const n of [node, mute, source]) {
      try { n?.disconnect(); } catch { /* ignore */ }
    }
    stream.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => undefined);
    setIosAudioSession("auto");
  };

  return {
    stop: async () => {
      if (recorder) {
        const rec = recorder;
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          try { rec.state !== "inactive" ? rec.stop() : resolve(); } catch { resolve(); }
        });
        teardown();
        const type = (rec.mimeType || mime || "audio/mp4").split(";")[0];
        const blob = new Blob(blobs, { type });
        if (blob.size < 2048) return null;
        return blobToDataUrl(blob);
      }
      const rate = ctx?.sampleRate ?? 48000;
      teardown();
      const blob = encodeWav(pcm, rate);
      if (blob.size < 2048) return null;
      return blobToDataUrl(blob);
    },
    cancel: () => {
      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* ignore */ }
      teardown();
    },
  };
}

/** Fallback for browsers without live mic: turn a picked/recorded audio file into a data URL. */
export async function audioFileToDataUrl(file: File): Promise<string> {
  const type = (file.type || "audio/mp4").split(";")[0];
  return blobToDataUrl(new Blob([await file.arrayBuffer()], { type }));
}

// ---------------------------------------------------------------------------
// Shared playback element — unlocked by a user gesture so iOS lets us autoplay
// replies later in the conversation.
// ---------------------------------------------------------------------------


function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

/** Call inside a click/tap handler to grant playback permission for later replies. */
export function unlockYajAudio(): void {
  const el = getSharedAudio();
  try {
    el.muted = true;
    el.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";
    void el.play().then(() => {
      el.pause();
      el.muted = false;
    }).catch(() => {
      el.muted = false;
    });
  } catch {
    /* ignore */
  }
}

export type PlayYajAudioOptions = {
  playbackRate?: number;
  muted?: boolean;
};

/** Play a data URL through the unlocked element. */
export function playYajAudio(
  src: string,
  onEnd?: () => void,
  opts: PlayYajAudioOptions = {},
): HTMLAudioElement {
  const el = getSharedAudio();
  el.pause();
  el.muted = opts.muted === true;
  el.playbackRate = opts.playbackRate && opts.playbackRate > 0 ? opts.playbackRate : 1;
  el.src = src;
  el.currentTime = 0;
  el.onended = () => onEnd?.();
  el.onerror = () => onEnd?.();
  void el.play().catch(() => onEnd?.());
  return el;
}

/** Resolves the in-flight playYajAudioAsync waiters (if any). */
let playWaiters: Array<() => void> = [];

function settlePlayWaiters() {
  const waiters = playWaiters;
  playWaiters = [];
  waiters.forEach((w) => w());
}

export type PlayYajAudioAsyncOptions = PlayYajAudioOptions & {
  /** When aborted, playback stops and the promise resolves (does not hang). */
  signal?: AbortSignal;
};

/**
 * Promise form of playYajAudio — resolves when the clip finishes, errors, is
 * stopped, or the optional AbortSignal fires. Never hangs after stopYajAudio().
 */
export function playYajAudioAsync(src: string, opts: PlayYajAudioAsyncOptions = {}): Promise<void> {
  const { signal, ...playOpts } = opts;
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      playWaiters = playWaiters.filter((w) => w !== finish);
      resolve();
    };

    const onAbort = () => {
      // Stop without recursively re-entering finish via settlePlayWaiters
      if (sharedAudio) {
        sharedAudio.onended = null;
        sharedAudio.onerror = null;
        sharedAudio.pause();
        sharedAudio.currentTime = 0;
      }
      finish();
    };

    playWaiters.push(finish);
    signal?.addEventListener("abort", onAbort, { once: true });
    playYajAudio(src, finish, playOpts);
  });
}

export function pauseYajAudio(): void {
  sharedAudio?.pause();
}

export function resumeYajAudio(): void {
  if (!sharedAudio) return;
  // Never restart a finished clip — that caused coaching lines to loop.
  if (sharedAudio.ended || sharedAudio.currentTime <= 0) return;
  void sharedAudio.play().catch(() => undefined);
}

export function stopYajAudio(): void {
  if (sharedAudio) {
    sharedAudio.onended = null;
    sharedAudio.onerror = null;
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
  }
  // Unblock any awaiters so the coach session can advance or abort cleanly.
  settlePlayWaiters();
}

/** True while the shared element is mid-clip (not ended). */
export function isYajAudioActive(): boolean {
  return Boolean(sharedAudio && !sharedAudio.paused && !sharedAudio.ended && sharedAudio.currentTime > 0);
}

/** YAJ-branded display names; ids map to OpenAI TTS voices under the hood. */
export const YAJ_TTS_VOICES = [
  { id: "nova", label: "Solace", blurb: "Warm & clear" },
  { id: "coral", label: "Harbor", blurb: "Soft coach" },
  { id: "shimmer", label: "Lumen", blurb: "Bright & kind" },
  { id: "alloy", label: "Crest", blurb: "Balanced" },
  { id: "sage", label: "Meadow", blurb: "Calm guide" },
  { id: "echo", label: "Anchor", blurb: "Clear & steady" },
  { id: "fable", label: "Lyric", blurb: "Storyteller" },
  { id: "onyx", label: "Ember", blurb: "Deep & calm" },
  { id: "ash", label: "Mist", blurb: "Soft spoken" },
  { id: "ballad", label: "Chorus", blurb: "Warm narrative" },
] as const;

export type YajTtsVoiceId = (typeof YAJ_TTS_VOICES)[number]["id"];

/** Open the device camera for YAJ voice vision (video only — mic stays separate). */
export async function acquireYajCameraStream(
  facing: "user" | "environment" = "environment",
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser.");
  }
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Couldn't open the camera.");
}

export function describeCameraError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Allow camera access, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || /in use|readable|track/i.test(msg)) {
    return "Your camera is busy in another app. Close it, then try again.";
  }
  if (name === "SecurityError") {
    return "Camera needs a secure (HTTPS) connection.";
  }
  return msg || "Couldn't open the camera. Try again.";
}

/**
 * Capture a JPEG data URL from the live camera preview for vision chat.
 * Downscales so multimodal requests stay lightweight.
 */
export async function captureYajVisionFrame(
  video: HTMLVideoElement,
  options: { mirror?: boolean; maxWidth?: number; quality?: number } = {},
): Promise<string | null> {
  const { mirror = false, maxWidth = 960, quality = 0.72 } = options;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
  }
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = Math.min(1, maxWidth / vw);
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

