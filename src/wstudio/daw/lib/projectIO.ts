/**
 * Project save / open helpers for the W.Studio DAW.
 *
 * Format: a single .wsproj JSON file with embedded WAVs for any audio clip
 * buffers. Uses the File System Access API where available so users can pick
 * their own folder and re-save in place; falls back to a download / file
 * input picker for browsers without the API (Safari, mobile, etc.).
 */
import { audioBufferToWav, type DawEngine } from "../engine/DawEngine";
import { computePeaks } from "../engine/Peaks";
import type { Clip, Track, TransportState } from "../engine/types";
import {
  serializePodcastVideos,
  hydratePodcastVideos,
  usePodcastVideoStore,
  type SerializedPodcastVideo,
} from "@/pages/podcast/podcastVideoStore";

const PROJECT_VERSION = 2;

interface SerializedClip extends Omit<Clip, "buffer" | "peaks"> {
  audioBase64?: string;
}

interface ProjectFile {
  version: number;
  name: string;
  pxPerSec?: number;
  verticalZoom?: number;
  transport?: Partial<TransportState>;
  tracks: Track[];
  clips: SerializedClip[];
  podcastVideos?: Record<string, SerializedPodcastVideo>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type = "audio/wav"): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function serializeProject(opts: {
  name: string;
  tracks: Track[];
  clips: Clip[];
  transport: TransportState;
  pxPerSec: number;
  verticalZoom: number;
}): Promise<string> {
  const sClips: SerializedClip[] = [];
  for (const c of opts.clips) {
    const { buffer, peaks, ...rest } = c;
    const out: SerializedClip = { ...rest };
    if (buffer) {
      const wav = audioBufferToWav(buffer);
      out.audioBase64 = await blobToBase64(wav);
    }
    sClips.push(out);
  }
  const file: ProjectFile = {
    version: PROJECT_VERSION,
    name: opts.name,
    pxPerSec: opts.pxPerSec,
    verticalZoom: opts.verticalZoom,
    transport: {
      bpm: opts.transport.bpm,
      timeSigNum: opts.transport.timeSigNum,
      timeSigDen: opts.transport.timeSigDen,
      keyRoot: opts.transport.keyRoot,
      keyMode: opts.transport.keyMode,
      loopStart: opts.transport.loopStart,
      loopEnd: opts.transport.loopEnd,
      loopEnabled: opts.transport.loopEnabled,
    },
    tracks: opts.tracks,
    clips: sClips,
    podcastVideos: await serializePodcastVideos(usePodcastVideoStore.getState().videos),
  };
  return JSON.stringify(file);
}

export async function parseProject(json: string, engine: DawEngine): Promise<{
  name: string;
  tracks: Track[];
  clips: Clip[];
  transport: Partial<TransportState>;
  pxPerSec?: number;
  verticalZoom?: number;
}> {
  const file = JSON.parse(json) as ProjectFile;
  if (!file || typeof file !== "object" || !Array.isArray(file.tracks)) {
    throw new Error("Not a valid W.Studio project file");
  }
  const clips: Clip[] = [];
  for (const sc of file.clips ?? []) {
    const { audioBase64, ...rest } = sc;
    const out: Clip = { ...(rest as Clip) };
    if (audioBase64) {
      try {
        const blob = base64ToBlob(audioBase64);
        const buffer = await engine.decodeFile(blob);
        out.buffer = buffer;
        out.peaks = computePeaks(buffer);
      } catch {
        // skip undecodable
      }
    }
    clips.push(out);
  }
  hydratePodcastVideos(file.podcastVideos);
  return {
    name: file.name || "Untitled Project",
    tracks: file.tracks,
    clips,
    transport: file.transport ?? {},
    pxPerSec: file.pxPerSec,
    verticalZoom: file.verticalZoom,
  };
}

function suggestedFilename(name: string): string {
  const safe = (name || "Untitled Project").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return `${safe || "Untitled Project"}.wsproj`;
}

async function downloadJson(name: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedFilename(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save using an existing FileSystemFileHandle if available, else fall back to Save As. */
export async function saveProjectTo(handle: any | null, opts: Parameters<typeof serializeProject>[0]): Promise<any | null> {
  const json = await serializeProject(opts);
  if (handle && typeof handle.createWritable === "function") {
    try {
      const w = await handle.createWritable();
      await w.write(json);
      await w.close();
      return handle;
    } catch {
      /* fall through to Save As */
    }
  }
  return await saveAsProject(opts, json);
}

export async function saveAsProject(
  opts: Parameters<typeof serializeProject>[0],
  preSerialized?: string,
): Promise<any | null> {
  const json = preSerialized ?? await serializeProject(opts);
  // File System Access API (Chrome/Edge)
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: suggestedFilename(opts.name),
        types: [{ description: "W.Studio Project", accept: { "application/json": [".wsproj"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return handle;
    } catch (err: any) {
      if (err?.name === "AbortError") return null;
      // fall through to download
    }
  }
  await downloadJson(opts.name, json);
  return null;
}

export async function openProject(engine: DawEngine): Promise<{
  parsed: Awaited<ReturnType<typeof parseProject>>;
  handle: any | null;
} | null> {
  const w = window as any;
  let json: string | null = null;
  let handle: any | null = null;
  if (typeof w.showOpenFilePicker === "function") {
    try {
      const [h] = await w.showOpenFilePicker({
        types: [{ description: "W.Studio Project", accept: { "application/json": [".wsproj", ".json"] } }],
        multiple: false,
      });
      handle = h;
      const file = await h.getFile();
      json = await file.text();
    } catch (err: any) {
      if (err?.name === "AbortError") return null;
    }
  }
  if (!json) {
    // Fallback: hidden input
    json = await new Promise<string | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".wsproj,application/json";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return resolve(null);
        resolve(await f.text());
      };
      input.click();
    });
    if (!json) return null;
  }
  const parsed = await parseProject(json, engine);
  return { parsed, handle };
}
