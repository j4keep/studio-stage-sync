/**
 * Wellness spoken guidance — same cloud TTS voice as the Move coach (nova / prefs).
 * Replaces browser speechSynthesis (“map voice”).
 */

import { speakableYajText } from "@/lib/yaj-pronounce";
import {
  playYajAudioAsync,
  stopYajAudio,
  synthesizeYajVoice,
  unlockYajAudio,
} from "@/lib/yaj-media";
import {
  getWellnessCoachPlaybackRate,
  getWellnessCoachVoice,
} from "@/lib/wellness-coach-prefs";

export type WellnessSpeakOptions = {
  calm?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Stop any current clip before speaking (default false). */
  interrupt?: boolean;
};

export type BreathPhase = "inhale" | "hold" | "exhale" | "holdOut";

export function humanizeCoachText(text: string): string {
  return speakableYajText(
    (text || "")
      .replace(/×\s*/g, "times ")
      .replace(/\bx\s*(\d+)/gi, "times $1")
      .replace(/(\d+)\s*s\b/gi, "$1 seconds")
      .replace(/(\d+)\s*sec\b/gi, "$1 seconds")
      .replace(/(\d+)\s*min\b/gi, "$1 minutes")
      .replace(/\bOK\b/g, "okay")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Cloud TTS is always available in-app (network); used for UI toggles. */
export function canWellnessSpeak(): boolean {
  return typeof window !== "undefined";
}

/** No-op keep-alive — cloud clips don't need speechSynthesis tricks. */
export function warmupWellnessVoice() {
  unlockYajAudio();
}

export function waitForWellnessVoices(_timeoutMs = 1200): Promise<void> {
  return Promise.resolve();
}

export function stopWellnessSpeak() {
  stopYajAudio();
}

export async function speakWellness(text: string, opts: WellnessSpeakOptions = {}): Promise<void> {
  const cleaned = humanizeCoachText(text);
  if (!cleaned || !canWellnessSpeak()) return;

  const { interrupt = false, rate } = opts;
  if (interrupt) stopYajAudio();

  unlockYajAudio();
  try {
    const voice = getWellnessCoachVoice();
    const src = await synthesizeYajVoice(cleaned, voice);
    const playbackRate = rate && rate > 0 ? rate : getWellnessCoachPlaybackRate();
    await playYajAudioAsync(src, { playbackRate });
  } catch {
    /* soft-fail — don't break the session if TTS is offline */
  }
}

export type MoveCoachOptions = {
  holdSeconds?: number;
  coachHint?: string;
  kind?: "stretch" | "walk" | "chair" | "bodyweight";
};

export function speakMoveStep(
  stepIndex: number,
  stepText: string,
  totalSteps: number,
  opts: MoveCoachOptions = {},
) {
  const n = stepIndex + 1;
  const body = humanizeCoachText(stepText);
  const hold = opts.holdSeconds && opts.holdSeconds > 0 ? opts.holdSeconds : 0;
  const holdLine =
    hold > 0
      ? hold >= 60
        ? ` Hold for about ${Math.round(hold / 60)} minute${hold >= 120 ? "s" : ""}.`
        : ` Hold for about ${hold} seconds.`
      : "";
  const hint = opts.coachHint ? ` ${humanizeCoachText(opts.coachHint)}` : "";
  const walkCue =
    opts.kind === "walk" && n < totalSteps
      ? " When you're ready, tap Next for the next cue."
      : "";

  let line: string;
  if (n === 1) {
    line = `Okay. Step ${n} of ${totalSteps}. ${body}.${holdLine}${hint}${walkCue}`;
  } else if (n === totalSteps) {
    line = `Last step. ${body}.${holdLine}${hint}`;
  } else {
    line = `Step ${n}. ${body}.${holdLine}${hint}${walkCue}`;
  }
  return speakWellness(line, { calm: true, interrupt: false });
}

const BREATH_COACH_LINES: Record<BreathPhase, string[]> = {
  inhale: [
    "Take a slow breath in through your nose.",
    "Breathe in gently… fill your lungs.",
    "Soft inhale… nice and easy.",
    "Draw the breath in… slowly.",
  ],
  hold: [
    "Hold gently.",
    "Pause here… soft and still.",
    "Hold… no strain.",
    "Stay with this quiet pause.",
  ],
  exhale: [
    "Now let everything go.",
    "Exhale slowly… release the day.",
    "Breathe out… soften your shoulders.",
    "Let the breath leave you completely.",
  ],
  holdOut: [
    "Rest empty for a moment.",
    "Hold gently at the bottom.",
    "Stay soft… almost ready for the next breath.",
    "Nice… keep following my voice.",
  ],
};

let breathLineCursor = 0;

export function breathCoachLine(phase: BreathPhase): string {
  const pool = BREATH_COACH_LINES[phase];
  const line = pool[breathLineCursor % pool.length];
  breathLineCursor += 1;
  return line;
}

export function speakBreathPhase(phase: BreathPhase, line?: string) {
  return speakWellness(line || breathCoachLine(phase), {
    calm: true,
    interrupt: true,
    rate: 0.88,
  });
}

/** On-screen short label (UI); spoken lines stay warmer via speakBreathPhase. */
export function breathPhaseLabel(phase: BreathPhase): string {
  return phase === "inhale"
    ? "Breathe In"
    : phase === "exhale"
      ? "Exhale"
      : "Hold";
}

export function breathPhaseHint(phase: BreathPhase): string {
  return phase === "inhale"
    ? "Slow deep inhale"
    : phase === "exhale"
      ? "Soft complete exhale"
      : phase === "hold"
        ? "Hold gently at the top"
        : "Rest before the next breath";
}

export function listWellnessVoices(): { name: string; lang: string; score: number; local: boolean }[] {
  return [];
}

export function getSelectedWellnessVoiceName(): string | null {
  return getWellnessCoachVoice();
}
