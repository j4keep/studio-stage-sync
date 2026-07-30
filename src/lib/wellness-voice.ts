/**
 * Soft spoken guidance for Wellness sessions (Move + breathing / wind-down).
 * Locks a consistent female companion voice for the whole session.
 */

import { speakableYajText } from "@/lib/yaj-pronounce";

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
let voiceLocked = false;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let voicesWaiters: Array<() => void> = [];

/** Voices that often sound like navigation / map assistants — deprioritize. */
const AVOID_VOICE =
  /google us english|english united states$|compact|network|android|eloquence|novelty|whisper|bad news|good news|zarvox|trinoids|boing|organ|cellos|bubbles|bahh|albert|bells|junior|kathy|princess|ralph|pipe organ|david|mark|daniel|thomas|fred|jorge|juan|james|john|alex|bruce|aaron|guy|ryan|tony|nathan|eric|christopher|steffan|roger/i;

const FEMALE_HINT =
  /female|woman|girl|samantha|karen|moira|fiona|tessa|veena|raveena|serena|victoria|karen|susan|zira|aria|jenny|sonia|sara|allison|ava|emma|joanna|ivy|nicole|amy|emma|olivia|lisa|helen|hazel|martha|catherine|nicky|melina|kyoko|ting-ting|sin-ji/i;

const PREFER_FEMALE = [
  /microsoft (aria|jenny|sonia|sara)/i,
  /samantha/i,
  /karen/i,
  /moira/i,
  /fiona/i,
  /tessa/i,
  /google uk english female/i,
  /neural.*female|female.*neural/i,
  /natural.*female|female.*natural/i,
  FEMALE_HINT,
];

function looksFemale(v: SpeechSynthesisVoice): boolean {
  return FEMALE_HINT.test(v.name) || /female/i.test(v.name);
}

function looksMale(v: SpeechSynthesisVoice): boolean {
  if (looksFemale(v)) return false;
  return /male|man|boy|david|mark|daniel|thomas|fred|james|john|alex|bruce|guy|ryan|tony|nathan|eric|roger|aaron/i.test(
    v.name,
  );
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name || "";
  const lang = (v.lang || "").toLowerCase();

  if (!/^en([-_]|$)/i.test(lang) && !/^en/i.test(name)) score -= 80;
  if (AVOID_VOICE.test(name)) score -= 120;
  if (looksMale(v)) score -= 200; // hard prefer woman
  if (looksFemale(v)) score += 120;

  for (let i = 0; i < PREFER_FEMALE.length; i++) {
    if (PREFER_FEMALE[i].test(name)) {
      score += 90 - i;
      break;
    }
  }

  if (v.localService) score += 20;
  if (/en-gb|en-au|en-ie|en-za/i.test(lang)) score += 18;
  if (/en-us/i.test(lang) && looksFemale(v)) score += 10;
  if (/neural|natural|premium|enhanced/i.test(name)) score += 35;

  return score;
}

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const english = voices.filter((v) => /^en/i.test(v.lang) || /^en/i.test(v.name));
  const pool = english.length ? english : voices;
  const females = pool.filter(looksFemale);
  const ranked = (females.length ? females : pool.filter((v) => !looksMale(v))).sort(
    (a, b) => scoreVoice(b) - scoreVoice(a),
  );
  return ranked[0] || pool.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

function ensureVoices(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  // Once locked to a female voice, never swap mid-session (fixes man→woman glitch)
  if (voiceLocked && preferredVoice) return preferredVoice;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return preferredVoice;

  const next = pickFemaleVoice(voices);
  if (next) {
    preferredVoice = next;
    if (looksFemale(next) || !voices.some(looksFemale)) {
      voiceLocked = true;
    }
  }
  return preferredVoice;
}

function notifyVoicesReady() {
  ensureVoices();
  const waiters = voicesWaiters;
  voicesWaiters = [];
  waiters.forEach((w) => w());
}

/** Wait briefly for browser voice list (Chrome loads async). */
export function waitForWellnessVoices(timeoutMs = 1200): Promise<void> {
  if (!canWellnessSpeak()) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) {
    ensureVoices();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    voicesWaiters.push(done);
    const timer = window.setTimeout(done, timeoutMs);
    warmupWellnessVoice();
  });
}

function startSpeechKeepAlive() {
  if (keepAliveTimer || typeof window === "undefined" || !("speechSynthesis" in window)) return;
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

export function warmupWellnessVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  ensureVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    // Only fill preferred if not locked yet — never flip gender mid-session
    if (!voiceLocked) {
      preferredVoice = null;
      ensureVoices();
    }
    notifyVoicesReady();
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

export async function speakWellness(text: string, opts: WellnessSpeakOptions = {}): Promise<void> {
  const cleaned = humanizeCoachText(text);
  if (!cleaned || !canWellnessSpeak()) return;

  await waitForWellnessVoices();

  const {
    calm = true,
    rate = calm ? 0.88 : 1,
    pitch = calm ? 1.0 : 1,
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
  return speakWellness(line, { calm: true, rate: 0.86, interrupt: false });
}

export function speakBreathPhase(phase: BreathPhase) {
  const lines: Record<BreathPhase, string> = {
    inhale: "Breathe in.",
    hold: "Hold.",
    exhale: "Breathe out.",
    holdOut: "Hold.",
  };
  return speakWellness(lines[phase], { calm: true, rate: 0.85, pitch: 1, interrupt: true });
}

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
