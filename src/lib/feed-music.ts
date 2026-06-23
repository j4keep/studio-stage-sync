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

export function playFeedMusicLoop(loopId: string, volume = 0.6): { stop: () => void } | null {
  const def = FEED_MUSIC_LOOPS.find((l) => l.id === loopId);
  if (!def) return null;
  const ctx = new AudioContext();
  const buf = generateLoop(def);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  return {
    stop: () => {
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
): { stop: () => void; audio: HTMLAudioElement } {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.loop = loop;
  void audio.play();
  return {
    audio,
    stop: () => {
      audio.pause();
      audio.src = "";
    },
  };
}

export function getMusicDisplayName(music?: { loopId?: string; fileName?: string; audioUrl?: string }): string {
  if (!music) return "Original sound";
  if (music.fileName) return music.fileName.replace(/\.[^.]+$/, "");
  if (music.audioUrl) return "Uploaded sound";
  if (music.loopId) return getFeedMusicName(music.loopId);
  return "Original sound";
}
