/**
 * Soft spoken guidance for Wellness sessions (Move + breathing / wind-down).
 * Uses the browser Web Speech API — no extra backend required.
 * This is a companion voice, not medical advice.
 */

export type WellnessSpeakOptions = {
  /** Prefer a calmer / softer voice when available */
  calm?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Cancel any current utterance before speaking */
  interrupt?: boolean;
};

let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

function pickCalmVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const preferred = [
    /samantha/i,
    /karen/i,
    /moira/i,
    /serena/i,
    /google us english/i,
    /google uk english female/i,
    /microsoft (aria|jenny|sara|zira)/i,
    /female/i,
    /en-us/i,
    /en-gb/i,
    /^en/i,
  ];
  for (const re of preferred) {
    const match = voices.find((v) => re.test(v.name) || re.test(v.lang));
    if (match) return match;
  }
  return voices[0] || null;
}

function ensureVoices(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    preferredVoice = pickCalmVoice(voices);
    voicesReady = true;
    return preferredVoice;
  }
  return preferredVoice;
}

/** Call once on app/session start so voices are cached (Chrome loads async). */
export function warmupWellnessVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  ensureVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    ensureVoices();
  };
}

export function canWellnessSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopWellnessSpeak() {
  if (!canWellnessSpeak()) return;
  window.speechSynthesis.cancel();
}

export function speakWellness(text: string, opts: WellnessSpeakOptions = {}): Promise<void> {
  const cleaned = (text || "").trim();
  if (!cleaned || !canWellnessSpeak()) return Promise.resolve();

  const { calm = true, rate = calm ? 0.92 : 1, pitch = calm ? 1.02 : 1, volume = 1, interrupt = true } = opts;

  return new Promise((resolve) => {
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleaned);
      const voice = ensureVoices();
      if (voice) utter.voice = voice;
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = volume;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

/** Cue lines for Move workout steps (Buddy coaches through the routine). */
export function speakMoveStep(stepIndex: number, stepText: string, totalSteps: number) {
  const n = stepIndex + 1;
  const prefix = n === 1 ? "Let's begin. " : n === totalSteps ? "Last step. " : `Step ${n}. `;
  return speakWellness(prefix + stepText, { calm: true, rate: 0.95 });
}

/** Cue lines for breathing phases during wind-down / relax. */
export function speakBreathPhase(phase: Phase) {
  const lines: Record<Phase, string> = {
    inhale: "Breathe in",
    hold: "Hold",
    exhale: "Breathe out",
    holdOut: "Hold",
  };
  return speakWellness(lines[phase], { calm: true, rate: 0.9, pitch: 1 });
}
