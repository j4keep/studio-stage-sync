import { generateLoop, type LoopDef } from "@/wstudio/daw/lib/loopGenerator";

/** Minimal loop defs for feed background music — no DAW catalog dependency. */
export const FEED_MUSIC_LOOPS: LoopDef[] = [
{ id: "bb-drums", name: "Boom Bap Drums", category: "drums", bpm: 92, bars: 2 },
{ id: "slime-inst", name: "Storm Instrumental", category: "synth", bpm: 150, bars: 4, key: "Eb3" },
{ id: "bb-piano", name: "Rhodes Loop", category: "piano", bpm: 92, bars: 2, key: "A3" },
{ id: "slime-sbass", name: "Synth Bass", category: "bass", bpm: 150, bars: 2, key: "Eb2" },
{ id: "bb-bass", name: "Street Bass", category: "bass", bpm: 92, bars: 2, key: "A1" },
];

export const FEED_MUSIC_PRESETS = FEED_MUSIC_LOOPS.map((l) => ({
id: l.id,
label: l.name,
}));

export type FeedMusicMeta =
| {
loopId?: string;
audioUrl?: string;
fileName?: string;
volume?: number;
durationSec?: number;
}
| undefined;

export function playFeedMusicLoop(
loopId: string,
volume = 0.6,
maxDurationSec?: number,
): { stop: () => void } | null {
const def = FEED_MUSIC_LOOPS.find((l) => l.id === loopId);
if (!def) return null;

const ctx = new AudioContext();
const buf = generateLoop(def);
const src = ctx.createBufferSource();
src.buffer = buf;
src.loop = !maxDurationSec;

const gain = ctx.createGain();
gain.gain.value = volume;

src.connect(gain);
gain.connect(ctx.destination);
src.start();

let durationTimer: ReturnType<typeof setTimeout> | null = null;

if (maxDurationSec && maxDurationSec > 0) {
durationTimer = setTimeout(() => {
try {
src.stop();
} catch {}
void ctx.close();
}, maxDurationSec * 1000);
}

return {
stop: () => {
if (durationTimer) clearTimeout(durationTimer);
try {
src.stop();
} catch {}
void ctx.close();
},
};
}

export function getFeedMusicName(loopId: string): string {
return FEED_MUSIC_LOOPS.find((l) => l.id === loopId)?.name ?? "Original sound";
}

/** iOS Safari needs explicit extensions — audio/* alone opens the photo library. */
export const AUDIO_FILE_ACCEPT =
".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/*";

export function playUploadedAudio(
url: string,
volume = 0.6,
loop = true,
maxDurationSec?: number,
): { stop: () => void; audio: HTMLAudioElement } {
const audio = new Audio(url);
audio.volume = volume;
audio.loop = loop && !(maxDurationSec && maxDurationSec > 0);

let durationTimer: ReturnType<typeof setTimeout> | null = null;

const stop = () => {
if (durationTimer) clearTimeout(durationTimer);
audio.pause();
audio.src = "";
};

void audio.play().catch(() => {});

if (maxDurationSec && maxDurationSec > 0) {
durationTimer = setTimeout(stop, maxDurationSec * 1000);
}

return { audio, stop };
}

/** Start post background music for preview only. */
export function playPostMusic(
music: FeedMusicMeta,
filePreviewUrl?: string | null,
): { stop: () => void } | null {
if (!music && !filePreviewUrl) return null;

const vol = music?.volume ?? 0.6;
const dur =
music?.durationSec && music.durationSec > 0 ? music.durationSec : undefined;

if (filePreviewUrl) {
return playUploadedAudio(filePreviewUrl, vol, !dur, dur);
}

if (music?.audioUrl) {
return playUploadedAudio(music.audioUrl, vol, !dur, dur);
}

if (music?.loopId) {
return playFeedMusicLoop(music.loopId, vol, dur);
}

return null;
}

export function getMusicDisplayName(music?: {
loopId?: string;
fileName?: string;
audioUrl?: string;
}): string {
if (!music) return "Original sound";
if (music.fileName) return music.fileName.replace(/.[^.]+$/, "");
if (music.audioUrl) return "Uploaded sound";
if (music.loopId) return getFeedMusicName(music.loopId);
return "Original sound";
}

/**

* TikTok-style recording helper.
*
* Creates ONE music stream that is:
* 1. audible to the user while recording
* 2. also routed into MediaRecorder
*
* This prevents the phone mic from trying to hear music through the air.
  */
  export async function createFeedMusicStream(
  music: FeedMusicMeta,
  filePreviewUrl?: string | null,
  ): Promise<{ stream: MediaStream; stop: () => void } | null> {
  if (!music && !filePreviewUrl) return null;

const ctx = new AudioContext();
const destination = ctx.createMediaStreamDestination();

const gain = ctx.createGain();
gain.gain.value = music?.volume ?? 0.45;

gain.connect(destination);
gain.connect(ctx.destination);

let sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
let audioEl: HTMLAudioElement | null = null;
let durationTimer: ReturnType<typeof setTimeout> | null = null;

const dur =
music?.durationSec && music.durationSec > 0 ? music.durationSec : undefined;

const stop = () => {
if (durationTimer) clearTimeout(durationTimer);

try {
  if (sourceNode && "stop" in sourceNode) {
    (sourceNode as AudioBufferSourceNode).stop();
  }
} catch {}

if (audioEl) {
  audioEl.pause();
  audioEl.src = "";
}

destination.stream.getTracks().forEach((t) => t.stop());
void ctx.close();

};

if (filePreviewUrl || music?.audioUrl) {
const url = filePreviewUrl || music?.audioUrl;
if (!url) {
stop();
return null;
}

audioEl = new Audio(url);
audioEl.crossOrigin = "anonymous";
audioEl.loop = !dur;

sourceNode = ctx.createMediaElementSource(audioEl);
sourceNode.connect(gain);

try {
  await audioEl.play();
} catch {
  stop();
  return null;
}

} else if (music?.loopId) {
const def = FEED_MUSIC_LOOPS.find((l) => l.id === music.loopId);
if (!def) {
stop();
return null;
}

const buffer = generateLoop(def);
const src = ctx.createBufferSource();
src.buffer = buffer;
src.loop = !dur;
sourceNode = src;
src.connect(gain);
src.start();

}

if (ctx.state === "suspended") {
await ctx.resume().catch(() => {});
}

if (dur) {
durationTimer = setTimeout(stop, dur * 1000);
}

return {
stream: destination.stream,
stop,
};
}
