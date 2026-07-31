import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";
import type { YajTtsVoiceId } from "@/lib/yaj-media";
import {
  loadYajAiPrefs,
  patchYajAiPrefs,
  type YajAiPrefs,
} from "@/lib/yaj-ai-prefs";

/**
 * Wellness / Move coach prefs — backed by the shared YAJ AI Generator prefs
 * so Profile → YAJ AI dashboard and Move settings stay in sync.
 */
export const WELLNESS_COACH_PREFS_KEY = "yaj_move_coach_prefs_v1";

export type WellnessCoachPrefs = {
  voice: YajTtsVoiceId;
  speed: CoachVoiceSpeedId;
  muted: boolean;
};

export function loadWellnessCoachPrefs(): WellnessCoachPrefs {
  const p = loadYajAiPrefs();
  return { voice: p.voice, speed: p.coachSpeed, muted: p.coachMuted };
}

export function saveWellnessCoachPrefs(p: WellnessCoachPrefs) {
  patchYajAiPrefs({
    voice: p.voice,
    coachSpeed: p.speed,
    coachMuted: p.muted,
  } satisfies Partial<YajAiPrefs>);
}

export function getWellnessCoachVoice(): YajTtsVoiceId {
  return loadWellnessCoachPrefs().voice;
}

export function getWellnessCoachPlaybackRate(): number {
  const speed = loadWellnessCoachPrefs().speed;
  return COACH_VOICE_SPEEDS.find((s) => s.id === speed)?.rate ?? 1;
}
