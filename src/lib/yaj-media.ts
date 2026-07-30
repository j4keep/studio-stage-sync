const FN = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

const authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

async function postJson<T>(name: string, body: unknown): Promise<T> {
  const resp = await fetch(FN(name), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data as T;
}

/** Generate an image with YAJ Buddy. Returns a data URL (or hosted URL). */
export async function generateYajImage(prompt: string): Promise<string> {
  const { image } = await postJson<{ image: string }>("yaj-image", { prompt });
  return image;
}

/** Turn text into natural spoken audio. Returns a playable data URL. */
export async function synthesizeYajVoice(text: string, voice?: string): Promise<string> {
  const { audio } = await postJson<{ audio: string }>("yaj-voice", { text, voice });
  return audio;
}

/** Transcribe a recorded clip into text. */
export async function transcribeYajAudio(dataUrl: string): Promise<string> {
  const { text } = await postJson<{ text: string }>("yaj-transcribe", { audio: dataUrl });
  return text;
}

/** Heuristic: does this message ask YAJ Buddy to make a picture? */
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

/** Start recording the mic. Resolves with a recorder whose stop() returns a WAV data URL. */
export async function startMicRecording(): Promise<MicRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx: typeof AudioContext =
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? window.AudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = () => {
    try { node.disconnect(); } catch { /* ignore */ }
    try { source.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: async () => {
      teardown();
      const rate = ctx.sampleRate;
      await ctx.close().catch(() => undefined);
      const blob = encodeWav(chunks, rate);
      if (blob.size < 2048) return null;
      return blobToDataUrl(blob);
    },
    cancel: () => {
      teardown();
      ctx.close().catch(() => undefined);
    },
  };
}
