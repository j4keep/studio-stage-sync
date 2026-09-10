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

/** Stay under yaj-voice 4000-char hard limit with headroom for pronunciation fixes. */
const CHUNK_LIMIT = 3600;

/** Book-reader speeds (independent of Move coach prefs). */
export const BOOK_NARRATION_SPEEDS = [
  { id: "0.8", label: "0.8×", rate: 0.8 },
  { id: "1", label: "1×", rate: 1 },
  { id: "1.2", label: "1.2×", rate: 1.2 },
  { id: "1.5", label: "1.5×", rate: 1.5 },
] as const;

export type BookNarrationSpeedId = (typeof BOOK_NARRATION_SPEEDS)[number]["id"];

export type NarrationHighlight = {
  paragraphIndex: number;
  sentenceIndex: number;
};

export type NarrationUnit = NarrationHighlight & {
  text: string;
};

export function bookNarrationVoiceLabel(): string {
  return getYajAiVoiceLabel();
}

export function playbackRateForBookSpeed(speed: BookNarrationSpeedId): number {
  return BOOK_NARRATION_SPEEDS.find((s) => s.id === speed)?.rate ?? 1;
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

/** Split a paragraph into sentences (display + TTS stay in sync). */
export function splitBookSentences(paragraph: string): string[] {
  const raw = (paragraph || "").trim();
  if (!raw) return [];
  const parts = raw.match(/[^.!?]+(?:[.!?]+(?:['’”"]*)?)(?:\s+|$)|[^.!?]+$/g);
  if (!parts?.length) return [raw];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Paragraphs as the reader renders them. */
export function splitBookParagraphs(pageText: string): string[] {
  return (pageText || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Build speakable units (sentence-level) for a page. */
export function buildNarrationUnits(pageText: string): NarrationUnit[] {
  const paragraphs = splitBookParagraphs(pageText);
  const units: NarrationUnit[] = [];
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const sentences = splitBookSentences(paragraphs[pi]);
    for (let si = 0; si < sentences.length; si++) {
      const text = prepareBookPageSpeech(sentences[si]);
      if (!text) continue;
      // Hard-split rare oversized sentences for the TTS limit.
      if (text.length <= CHUNK_LIMIT) {
        units.push({ paragraphIndex: pi, sentenceIndex: si, text });
      } else {
        let rest = text;
        while (rest.length > CHUNK_LIMIT) {
          let cut = rest.lastIndexOf(" ", CHUNK_LIMIT);
          if (cut < CHUNK_LIMIT * 0.4) cut = CHUNK_LIMIT;
          units.push({ paragraphIndex: pi, sentenceIndex: si, text: rest.slice(0, cut).trim() });
          rest = rest.slice(cut).trim();
        }
        if (rest) units.push({ paragraphIndex: pi, sentenceIndex: si, text: rest });
      }
    }
  }
  return units;
}

export type SpeakBookPageOptions = {
  speed: BookNarrationSpeedId;
  signal?: AbortSignal;
  onHighlight?: (highlight: NarrationHighlight | null) => void;
  /** Fires once the first audio clip actually starts playing. */
  onPlaybackStart?: () => void;
};

/**
 * Speak one page sentence-by-sentence (with prefetch). Resolves when finished,
 * aborted, or soft-failed. Does not throw for network TTS errors.
 */
export async function speakBookPage(text: string, opts: SpeakBookPageOptions): Promise<"done" | "aborted" | "error"> {
  const units = buildNarrationUnits(text);
  if (!units.length) {
    opts.onHighlight?.(null);
    return "done";
  }

  unlockYajAudio();
  const voice = getYajAiVoice();
  const rate = playbackRateForBookSpeed(opts.speed);
  let started = false;

  try {
    let pending: Promise<string> | null = synthesizeYajVoice(units[0].text, voice);

    for (let i = 0; i < units.length; i++) {
      if (opts.signal?.aborted) {
        opts.onHighlight?.(null);
        return "aborted";
      }

      const unit = units[i];
      opts.onHighlight?.({ paragraphIndex: unit.paragraphIndex, sentenceIndex: unit.sentenceIndex });

      const src = await pending!;
      if (opts.signal?.aborted) {
        opts.onHighlight?.(null);
        return "aborted";
      }

      pending =
        i + 1 < units.length ? synthesizeYajVoice(units[i + 1].text, voice) : null;

      if (!started) {
        started = true;
        opts.onPlaybackStart?.();
      }

      await playYajAudioAsync(src, { playbackRate: rate, signal: opts.signal });
      if (opts.signal?.aborted) {
        opts.onHighlight?.(null);
        return "aborted";
      }
    }

    opts.onHighlight?.(null);
    return "done";
  } catch {
    stopYajAudio();
    opts.onHighlight?.(null);
    return "error";
  }
}

export function stopBookNarration() {
  stopYajAudio();
}
