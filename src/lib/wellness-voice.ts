/**
 * Soft spoken guidance for Wellness sessions (Move + breathing / wind-down).
 * Uses the browser Web Speech API — picks the most natural available voice
 * (avoids robotic “map / GPS” voices). Companion only, not medical advice.
 */

export type WellnessSpeakOptions = {
  calm?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Cancel any current utterance before speaking (default false — queue instead so steps aren’t skipped) */
  interrupt?: boolean;
};

export type BreathPhase = "inhale" | "hold" | "exhale" | "holdOut";

let preferredVoice: SpeechSynthesisVoice | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

/** Voices that often sound like navigation / map assistants — deprioritize. */
const AVOID_VOICE = /google us english|english united states$|compact|network|android|eloquence|novelty|whisper|bad news|good news|zarvox|trinoids|boing|organ|cellos|bubbles|bahh|albert|bells|junior|kathy|princess|ralph|pipe organ/i;

/** Prefer natural / neural / human-sounding English voices. */
const PREFER_VOICE = [
  /neural/i,
  /natural/i,
  /premium/i,
  /enhanced/i,
  /microsoft (aria|jenny|guy|ryan|sonia|sara)/i,
  /samantha/i,
  /karen/i,
  /moira/i,
  /fiona/i,
  /tessa/i,
  /veena/i,
  /raveena/i,
  /google uk english female/i,
  /google australian english/i,
  /google \(uk|en-gb\)/i,
  /en-gb.*female|female.*en-gb/i,
  /en-au/i,
  /en-ie/i,
  /en-za/i,
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name || "";
  const lang = (v.lang || "").toLowerCase();

  if (!/^en([-_]|$)/i.test(lang) && !/^en/i.test(name)) score -= 50;
  if (AVOID_VOICE.test(name)) score -= 100;

  for (let i = 0; i < PREFER_VOICE.length; i++) {
    if (PREFER_VOICE[i].test(name) || PREFER_VOICE[i].test(lang)) {
      score += 80 - i;
      break;
    }
  }

  // Local voices are usually more natural / lower latency than remote "map" voices
  if (v.localService) score += 25;
  if (/en-gb|en-au|en-ie|en-za/i.test(lang)) score += 15;
  if (/en-us/i.test(lang) && !AVOID_VOICE.test(name)) score += 5;
  if (/female|woman|girl/i.test(name)) score += 8;
  if (/male|man|boy|david|mark|daniel|thomas/i.test(name) && !/female/i.test(name)) score += 4;

  return score;
}

function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] || null;
}

function ensureVoices(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    preferredVoice = pickNaturalVoice(voices);
    return preferredVoice;
  }
  return preferredVoice;
}

function startSpeechKeepAlive() {
  if (keepAliveTimer || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // Chrome bug: speechSynthesis silently stops after ~15s without pause/resume
  keepAliveTimer = setInterval(() => {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    } catch {
      /* ignore */
    }
  }, 8000);
}

function stopSpeechKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/** Make workout copy sound more spoken / less robotic. */
export function humanizeCoachText(text: string): string {
  return (text || "")
    .replace(/×\s*/g, "times ")
    .replace(/\bx\s*(\d+)/gi, "times $1")
    .replace(/(\d+)\s*s\b/gi, "$1 seconds")
    .replace(/(\d+)\s*sec\b/gi, "$1 seconds")
    .replace(/(\d+)\s*min\b/gi, "$1 minutes")
    .replace(/\bOK\b/g, "okay")
    .replace(/\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/** Call once so voices are cached (Chrome loads them async). */
export function warmupWellnessVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  ensureVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = null;
    ensureVoices();
  };
}

export function canWellnessSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopWellnessSpeak() {
  if (!canWellnessSpeak()) return;
  window.speechSynthesis.cancel();
  stopSpeechKeepAlive();
}

/**
 * Speak calmly. By default queues (does not cancel) so Move steps aren’t skipped.
 * Pass interrupt:true only when you intentionally replace the current line.
 */
export function speakWellness(text: string, opts: WellnessSpeakOptions = {}): Promise<void> {
  const cleaned = humanizeCoachText(text);
  if (!cleaned || !canWellnessSpeak()) return Promise.resolve();

  // Natural companion pacing — slower than default map/GPS voice
  const {
    calm = true,
    rate = calm ? 0.88 : 1,
    pitch = calm ? 0.98 : 1,
    volume = 1,
    interrupt = false,
  } = opts;

  return new Promise((resolve) => {
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleaned);
      const voice = ensureVoices();
      if (voice) {
        utter.voice = voice;
        // Keep language aligned with the chosen voice
        if (voice.lang) utter.lang = voice.lang;
      } else {
        utter.lang = "en-GB";
      }
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = volume;
      utter.onend = () => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          stopSpeechKeepAlive();
        }
        resolve();
      };
      utter.onerror = () => resolve();
      startSpeechKeepAlive();
      window.speechSynthesis.speak(utter);
      // Some browsers need a kick after queueing
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    } catch {
      resolve();
    }
  });
}

/** Speak one Move step clearly — waits in queue so no steps are dropped. */
export function speakMoveStep(stepIndex: number, stepText: string, totalSteps: number) {
  const n = stepIndex + 1;
  const body = humanizeCoachText(stepText);
  let line: string;
  if (n === 1) {
    line = `Okay. Step ${n} of ${totalSteps}. ${body}.`;
  } else if (n === totalSteps) {
    line = `Last step. Step ${n}. ${body}.`;
  } else {
    line = `Step ${n}. ${body}.`;
  }
  // Queue — do not interrupt, so every rule/step is spoken
  return speakWellness(line, { calm: true, rate: 0.86, interrupt: false });
}

/** Cue lines for breathing phases during wind-down / relax. */
export function speakBreathPhase(phase: BreathPhase) {
  const lines: Record<BreathPhase, string> = {
    inhale: "Breathe in.",
    hold: "Hold.",
    exhale: "Breathe out.",
    holdOut: "Hold.",
  };
  return speakWellness(lines[phase], { calm: true, rate: 0.85, pitch: 0.98, interrupt: true });
}

/** List voices ranked for debugging / future voice picker. */
export function listWellnessVoices(): { name: string; lang: string; score: number; local: boolean }[] {
  if (!canWellnessSpeak()) return [];
  return window.speechSynthesis
    .getVoices()
    .map((v) => ({ name: v.name, lang: v.lang, score: scoreVoice(v), local: v.localService }))
    .sort((a, b) => b.score - a.score);
}

export function getSelectedWellnessVoiceName(): string | null {
  const v = ensureVoices();
  return v?.name ?? null;
}
