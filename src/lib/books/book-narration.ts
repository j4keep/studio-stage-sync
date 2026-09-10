/**
 * Book "Read to me" — uses the user's chosen YAJ Buddy TTS voice
 * (same prefs as Ask YAJ / wellness coach).
 */

import { speakableYajText } from "@/lib/yaj-pronounce";
import {
  playYajAudioAsync,
  stopYajAudio,
  synthesizeYajVoice,
  unlockYajAudio,
} from "@/lib/yaj-media";
import { getYajAiVoice, getYajAiVoiceLabel } from "@/lib/yaj-ai-prefs";
import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";

/** Stay under yaj-voice 4000-char hard limit with headroom for pronunciation fixes. */
const CHUNK_LIMIT = 3600;

export function bookNarrationVoiceLabel(): string {
  return getYajAiVoiceLabel();
}

export function playbackRateForSpeed(speed: CoachVoiceSpeedId): number {
  return COACH_VOICE_SPEEDS.find((s) => s.id === speed)?.rate ?? 1;
}

/** Clean page copy for TTS (strip markdown-ish noise, collapse whitespace). */
export function prepareBookPageSpeech(text: string): string {
  return speakableYajText(
    (text || "")
      .replace(/[*_`#>~]/g, "")
      .replace(/\u2014|\u2013/g, " — ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Split long pages into speakable chunks at sentence boundaries when possible. */
export function chunkBookSpeech(text: string, limit = CHUNK_LIMIT): string[] {
  const cleaned = prepareBookPageSpeech(text);
  if (!cleaned) return [];
  if (cleaned.length <= limit) return [cleaned];

  const chunks: string[] = [];
  let rest = cleaned;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf(". ", limit);
    if (cut < limit * 0.45) cut = rest.lastIndexOf("! ", limit);
    if (cut < limit * 0.45) cut = rest.lastIndexOf("? ", limit);
    if (cut < limit * 0.45) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.3) cut = limit;
    else cut += 1; // include the space / end of sentence punctuation window
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export type SpeakBookPageOptions = {
  speed: CoachVoiceSpeedId;
  signal?: AbortSignal;
};

/**
 * Speak one page (possibly multiple TTS clips). Resolves when finished,
 * aborted, or soft-failed. Does not throw for network TTS errors.
 */
export async function speakBookPage(text: string, opts: SpeakBookPageOptions): Promise<"done" | "aborted" | "error"> {
  const chunks = chunkBookSpeech(text);
  if (!chunks.length) return "done";

  unlockYajAudio();
  const voice = getYajAiVoice();
  const rate = playbackRateForSpeed(opts.speed);

  try {
    for (const chunk of chunks) {
      if (opts.signal?.aborted) return "aborted";
      const src = await synthesizeYajVoice(chunk, voice);
      if (opts.signal?.aborted) return "aborted";
      await playYajAudioAsync(src, { playbackRate: rate, signal: opts.signal });
      if (opts.signal?.aborted) return "aborted";
    }
    return "done";
  } catch {
    stopYajAudio();
    return "error";
  }
}

export function stopBookNarration() {
  stopYajAudio();
}
