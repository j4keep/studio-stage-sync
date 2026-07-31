import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";
import { YAJ_TTS_VOICES, type YajTtsVoiceId } from "@/lib/yaj-media";

/** App-wide YAJ AI Generator preferences (conversations + wellness voice). */
export const YAJ_AI_PREFS_KEY = "yaj_ai_prefs_v1";
/** Legacy Move coach key — migrated on first read. */
const LEGACY_MOVE_PREFS_KEY = "yaj_move_coach_prefs_v1";

export const YAJ_AI_UPDATED_EVENT = "yaj-ai-prefs-updated";

export type YajAiPrefs = {
  /** Cloud TTS voice for Ask YAJ, wellness, Move. */
  voice: YajTtsVoiceId;
  /** Speak rate used by Move / breathing coach. */
  coachSpeed: CoachVoiceSpeedId;
  /** Move coach starts muted when true. */
  coachMuted: boolean;
  /** In Live / voice mode, talking can interrupt YAJ mid-reply. */
  interruptLive: boolean;
};

const DEFAULTS: YajAiPrefs = {
  voice: "nova",
  coachSpeed: "normal",
  coachMuted: false,
  interruptLive: true,
};

function normalize(raw: Partial<YajAiPrefs> | null | undefined): YajAiPrefs {
  const voice = YAJ_TTS_VOICES.some((v) => v.id === raw?.voice)
    ? (raw!.voice as YajTtsVoiceId)
    : DEFAULTS.voice;
  const coachSpeed = COACH_VOICE_SPEEDS.some((s) => s.id === raw?.coachSpeed)
    ? (raw!.coachSpeed as CoachVoiceSpeedId)
    : DEFAULTS.coachSpeed;
  return {
    voice,
    coachSpeed,
    coachMuted: Boolean(raw?.coachMuted),
    interruptLive: raw?.interruptLive === undefined ? true : Boolean(raw.interruptLive),
  };
}

function migrateLegacy(): Partial<YajAiPrefs> | null {
  try {
    const legacy = localStorage.getItem(LEGACY_MOVE_PREFS_KEY);
    if (!legacy) return null;
    const p = JSON.parse(legacy) as { voice?: string; speed?: string; muted?: boolean };
    return {
      voice: p.voice as YajTtsVoiceId | undefined,
      coachSpeed: p.speed as CoachVoiceSpeedId | undefined,
      coachMuted: p.muted,
    };
  } catch {
    return null;
  }
}

export function loadYajAiPrefs(): YajAiPrefs {
  try {
    const raw = localStorage.getItem(YAJ_AI_PREFS_KEY);
    if (raw) return normalize(JSON.parse(raw) as Partial<YajAiPrefs>);
    const legacy = migrateLegacy();
    if (legacy) {
      const merged = normalize(legacy);
      saveYajAiPrefs(merged);
      return merged;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveYajAiPrefs(next: YajAiPrefs) {
  const normalized = normalize(next);
  try {
    localStorage.setItem(YAJ_AI_PREFS_KEY, JSON.stringify(normalized));
    // Keep Move coach key in sync for older session code paths.
    localStorage.setItem(
      LEGACY_MOVE_PREFS_KEY,
      JSON.stringify({
        voice: normalized.voice,
        speed: normalized.coachSpeed,
        muted: normalized.coachMuted,
      }),
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(YAJ_AI_UPDATED_EVENT, { detail: normalized }));
}

export function patchYajAiPrefs(patch: Partial<YajAiPrefs>): YajAiPrefs {
  const next = normalize({ ...loadYajAiPrefs(), ...patch });
  saveYajAiPrefs(next);
  return next;
}

export function getYajAiVoice(): YajTtsVoiceId {
  return loadYajAiPrefs().voice;
}

export function getYajAiInterruptLive(): boolean {
  return loadYajAiPrefs().interruptLive;
}

export function getYajAiVoiceLabel(): string {
  const id = getYajAiVoice();
  return YAJ_TTS_VOICES.find((v) => v.id === id)?.label ?? "Nova";
}
