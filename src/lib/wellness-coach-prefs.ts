import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";
import { YAJ_TTS_VOICES, type YajTtsVoiceId } from "@/lib/yaj-media";

/** Shared with Move coach settings — one voice across Wellness. */
export const WELLNESS_COACH_PREFS_KEY = "yaj_move_coach_prefs_v1";

export type WellnessCoachPrefs = {
  voice: YajTtsVoiceId;
  speed: CoachVoiceSpeedId;
  muted: boolean;
};

const DEFAULT_PREFS: WellnessCoachPrefs = {
  voice: "nova",
  speed: "normal",
  muted: false,
};

export function loadWellnessCoachPrefs(): WellnessCoachPrefs {
  try {
    const raw = localStorage.getItem(WELLNESS_COACH_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw) as Partial<WellnessCoachPrefs>;
    const voice = YAJ_TTS_VOICES.some((v) => v.id === p.voice) ? (p.voice as YajTtsVoiceId) : "nova";
    const speed = COACH_VOICE_SPEEDS.some((s) => s.id === p.speed)
      ? (p.speed as CoachVoiceSpeedId)
      : "normal";
    return { voice, speed, muted: Boolean(p.muted) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveWellnessCoachPrefs(p: WellnessCoachPrefs) {
  try {
    localStorage.setItem(WELLNESS_COACH_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** TTS voice id used by Move / breathing / sleep / Ask YAJ speak. */
export function getWellnessCoachVoice(): YajTtsVoiceId {
  return loadWellnessCoachPrefs().voice;
}

/** Playback rate matching Move coach speed pref. */
export function getWellnessCoachPlaybackRate(): number {
  const speed = loadWellnessCoachPrefs().speed;
  return COACH_VOICE_SPEEDS.find((s) => s.id === speed)?.rate ?? 1;
}
