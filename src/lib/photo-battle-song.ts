/** Photo battles only allow a short song clip under the photo — not a full track. */
export const PHOTO_BATTLE_SONG_MAX_SEC = 30;

export async function getAudioDurationSec(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const duration = await new Promise<number>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        const d = audio.duration;
        if (!Number.isFinite(d) || d <= 0) {
          reject(new Error("Could not read audio duration"));
          return;
        }
        resolve(d);
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not load audio file"));
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("error", onError);
      audio.src = url;
    });
    return duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function needsPhotoBattleSongTrim(durationSec: number): boolean {
  return durationSec > PHOTO_BATTLE_SONG_MAX_SEC + 0.05;
}

export function formatClipTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/** Export a fixed-length clip from an audio file as WAV. */
export async function sliceAudioFile(
  file: File,
  startSec: number,
  durationSec = PHOTO_BATTLE_SONG_MAX_SEC,
): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = decoded.sampleRate;
    const channels = decoded.numberOfChannels;
    const startSample = Math.max(0, Math.floor(startSec * sampleRate));
    const length = Math.min(
      Math.floor(durationSec * sampleRate),
      Math.max(0, decoded.length - startSample),
    );
    if (length <= 0) throw new Error("Invalid trim range");

    const sliced = audioCtx.createBuffer(channels, length, sampleRate);
    for (let c = 0; c < channels; c++) {
      const src = decoded.getChannelData(c).subarray(startSample, startSample + length);
      sliced.copyToChannel(new Float32Array(src), c);
    }

    const wav = audioBufferToWav(sliced);
    const base = file.name.replace(/\.[^.]+$/, "") || "battle-clip";
    return new File([wav], `${base}-30s.wav`, { type: "audio/wav" });
  } finally {
    void audioCtx.close().catch(() => undefined);
  }
}
