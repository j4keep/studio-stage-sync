import { generateLoop, type LoopDef } from "@/wstudio/daw/lib/loopGenerator";

/** Minimal loop defs for feed background music — no DAW catalog dependency. */
export const FEED_MUSIC_LOOPS: LoopDef[] = [
  { id: "bb-drums", name: "Boom Bap Drums", category: "drums", bpm: 92, bars: 2 },
  { id: "slime-inst", name: "Storm Instrumental", category: "synth", bpm: 150, bars: 4, key: "Eb3" },
  { id: "bb-piano", name: "Rhodes Loop", category: "piano", bpm: 92, bars: 2, key: "A3" },
  { id: "slime-sbass", name: "Synth Bass", category: "bass", bpm: 150, bars: 2, key: "Eb2" },
  { id: "bb-bass", name: "Street Bass", category: "bass", bpm: 92, bars: 2, key: "A1" },
];

export const FEED_MUSIC_PRESETS = FEED_MUSIC_LOOPS.map((l) => ({ id: l.id, label: l.name }));

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
      } catch {
        /* already stopped */
      }
      void ctx.close();
    }, maxDurationSec * 1000);
  }
  return {
    stop: () => {
      if (durationTimer) clearTimeout(durationTimer);
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
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

/** Start post background music from editor meta + optional local upload preview URL. */
export function playPostMusic(
  music: { loopId?: string; audioUrl?: string; volume?: number; durationSec?: number } | undefined,
  filePreviewUrl?: string | null,
): { stop: () => void } | null {
  if (!music && !filePreviewUrl) return null;
  const vol = music?.volume ?? 0.6;
  const dur = music?.durationSec && music.durationSec > 0 ? music.durationSec : undefined;

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

export function getMusicDisplayName(music?: { loopId?: string; fileName?: string; audioUrl?: string }): string {
  if (!music) return "Original sound";
  if (music.fileName) return music.fileName.replace(/\.[^.]+$/, "");
  if (music.audioUrl) return "Uploaded sound";
  if (music.loopId) return getFeedMusicName(music.loopId);
  return "Original sound";
}
