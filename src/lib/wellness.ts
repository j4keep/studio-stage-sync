/** Wellness Phase 1 — calm routines, local-only progress. Not medical advice. */

import {
  resolveDemoClip,
  type DemoClip,
  type WellnessDemoId,
} from "@/lib/wellness-demos";

export type { DemoClip, WellnessDemoId };
export { resolveDemoClip };

export type MoodId = "great" | "good" | "tired" | "stressed" | "anxious" | "low";

export type WellnessPillar = "sleep" | "move" | "relax" | "habits";

export type HabitId =
  | "water"
  | "walk"
  | "bed_earlier"
  | "stretch"
  | "screen_break"
  | "read"
  | "meal_prep";

export const MOODS: { id: MoodId; label: string; emoji: string }[] = [
  { id: "great", label: "Great", emoji: "☀️" },
  { id: "good", label: "Good", emoji: "🙂" },
  { id: "tired", label: "Tired", emoji: "😴" },
  { id: "stressed", label: "Stressed", emoji: "💨" },
  { id: "anxious", label: "Anxious", emoji: "🌊" },
  { id: "low", label: "Low energy", emoji: "🌱" },
];

/**
 * Seed prompt for Ask YAJ voice mode from the Wellness mood check-in.
 * Spoken reply should stay short, warm, and actionable.
 */
export function moodVoicePrompt(mood: MoodId): string {
  switch (mood) {
    case "great":
      return "I'm feeling great today. Congratulate me briefly in a warm way, then give one tiny wellness tip to keep the good energy going. Keep your spoken reply under a minute.";
    case "good":
      return "I'm feeling pretty good today. Acknowledge that warmly, then offer one gentle tip to help me stay balanced. Keep your spoken reply under a minute.";
    case "tired":
      return "I'm feeling tired. Help me gently — suggest one short reset I can do right now for energy without pushing hard. Keep your spoken reply under a minute.";
    case "stressed":
      return "I'm feeling stressed right now. Please help me calm down. Guide me through one short grounding or breathing tip I can do in this moment. Keep it warm and under a minute of speaking.";
    case "anxious":
      return "I'm feeling anxious. Speak calmly and help me settle. Offer one simple grounding practice I can try right now. Keep your spoken reply under a minute.";
    case "low":
      return "I'm feeling low energy. Be kind and encouraging. Suggest one small, easy step that might help me feel a little better today. Keep your spoken reply under a minute.";
    default:
      return "I'm checking in about how I feel today. Give me brief, warm wellness guidance I can use right now. Keep your spoken reply under a minute.";
  }
}

export const HABIT_OPTIONS: {
  id: HabitId;
  label: string;
  hint: string;
  progressKey: "water" | "move" | "sleep" | "mindful";
}[] = [
  { id: "water", label: "Drink more water", hint: "Sip through the day", progressKey: "water" },
  { id: "walk", label: "Walk daily", hint: "Even 10 minutes counts", progressKey: "move" },
  { id: "bed_earlier", label: "Go to bed earlier", hint: "Gentle wind-down", progressKey: "sleep" },
  { id: "stretch", label: "Stretch", hint: "Loosen up once today", progressKey: "move" },
  { id: "screen_break", label: "Take screen breaks", hint: "Eyes and mind rest", progressKey: "mindful" },
  { id: "read", label: "Read", hint: "A few pages is enough", progressKey: "mindful" },
  { id: "meal_prep", label: "Meal preparation", hint: "One simple prep step", progressKey: "water" },
];

/** Ambient track id (see wellness-ambient-catalog). Legacy aliases still resolve. */
export type SleepSoundId = string;

/** Featured Sleep shortcuts on older surfaces — map to the ambient catalog. */
export const SLEEP_SOUNDS: {
  id: SleepSoundId;
  label: string;
  blurb: string;
}[] = [
  { id: "heavy-rain", label: "Heavy Rain", blurb: "Steady downpour for wind-down" },
  { id: "ocean-night", label: "Ocean Waves", blurb: "Calm shoreline wash" },
  { id: "box-fan", label: "Box Fan", blurb: "Gentle hum" },
  { id: "white-noise", label: "White Noise", blurb: "Even, calming static" },
  { id: "forest-birds", label: "Forest Night", blurb: "Soft woodland air" },
];

/**
 * Move step references a catalog demo id. Visuals are illustration guide cards;
 * YAJ speaks the cue (and hold time for stretches).
 */
export type MoveStep = {
  instruction: string;
  demoId: WellnessDemoId;
  /** Suggested hold / side duration for stretches (spoken by YAJ). */
  holdSeconds?: number;
  /** Extra coach line after the instruction. */
  coachHint?: string;
};

export type BreathingPattern = {
  id: string;
  title: string;
  minutes: number;
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
  blurb: string;
  /** Catalog demo id for posture / calm visual */
  demoId?: WellnessDemoId;
};

export const BREATHING_SESSIONS: BreathingPattern[] = [
  {
    id: "box",
    title: "Box Breathing",
    minutes: 3,
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdOut: 4,
    blurb: "Even rhythm to settle the mind",
    demoId: "breath-box",
  },
  {
    id: "calm",
    title: "Calm Breathing",
    minutes: 5,
    inhale: 4,
    hold: 1,
    exhale: 6,
    blurb: "Longer exhales to ease tension",
    demoId: "breath-wind-down",
  },
  {
    id: "wind-down",
    title: "Bedtime Wind Down",
    minutes: 5,
    inhale: 4,
    hold: 2,
    exhale: 6,
    blurb: "Gentle breath before sleep",
    demoId: "breath-wind-down",
  },
  {
    id: "reset-2",
    title: "Instant Reset",
    minutes: 2,
    inhale: 3,
    hold: 1,
    exhale: 5,
    blurb: "Quick stress release anytime",
    demoId: "breath-reset",
  },
];

export type MoveRoutine = {
  id: string;
  title: string;
  minutes: number;
  level: "gentle" | "beginner";
  kind: "stretch" | "walk" | "chair" | "bodyweight";
  steps: MoveStep[];
};

/** Each step points at a YAJ form-guide card; voice coaching fills in the how-to. */
export const MOVE_ROUTINES: MoveRoutine[] = [
  {
    id: "stretch-5",
    title: "5-minute stretch",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    steps: [
      {
        instruction: "Roll shoulders slowly 8 times",
        demoId: "stretch-shoulders",
        holdSeconds: 5,
        coachHint: "Keep the motion smooth — no forcing.",
      },
      {
        instruction: "Neck tilts left and right",
        demoId: "stretch-neck-tilts",
        holdSeconds: 5,
        coachHint: "Hold each side about 5 seconds, then switch.",
      },
      {
        instruction: "Reach arms overhead and breathe",
        demoId: "stretch-arms-overhead",
        holdSeconds: 8,
        coachHint: "Inhale as you reach, exhale as you lower.",
      },
      {
        instruction: "Forward fold as far as feels easy",
        demoId: "stretch-forward-fold",
        holdSeconds: 10,
        coachHint: "Soft knees are fine. Hold where it feels gentle.",
      },
      {
        instruction: "Hip circles, then shake out legs",
        demoId: "stretch-hip-circles",
        holdSeconds: 5,
        coachHint: "Circle both directions, then shake it out.",
      },
    ],
  },
  {
    id: "walk-10",
    title: "Easy walking plan",
    minutes: 10,
    level: "beginner",
    kind: "walk",
    steps: [
      {
        instruction: "Stand tall, soft knees",
        demoId: "walk-stand-tall",
        coachHint: "When you're ready, tap Next to start walking.",
      },
      {
        instruction: "Walk at a conversational pace",
        demoId: "walk-naturally",
        coachHint: "You should still be able to talk. Tap Next when you want the next cue.",
      },
      {
        instruction: "Swing arms naturally",
        demoId: "walk-swing-arms",
        coachHint: "Loose shoulders, easy swing. Tap Next when ready.",
      },
      {
        instruction: "Optional: 1-minute brisk finish",
        demoId: "walk-brisk-finish",
        coachHint: "Pick up the pace a little — not a sprint. Tap Next to cool down.",
      },
      {
        instruction: "Cool down with slow steps",
        demoId: "walk-cool-down",
        coachHint: "Slow it down and finish with an easy breath.",
      },
    ],
  },
  {
    id: "chair-8",
    title: "Chair mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    steps: [
      {
        instruction: "Seated marches, 30 seconds",
        demoId: "chair-seated-marches",
        holdSeconds: 30,
      },
      {
        instruction: "Seated torso twists",
        demoId: "chair-torso-twists",
        holdSeconds: 5,
        coachHint: "Hold each side briefly, then switch.",
      },
      {
        instruction: "Ankle circles both sides",
        demoId: "chair-ankle-circles",
        holdSeconds: 5,
      },
      {
        instruction: "Seated side reaches",
        demoId: "chair-side-reaches",
        holdSeconds: 5,
        coachHint: "Reach and hold about 5 seconds each side.",
      },
      {
        instruction: "Stand and sit 6 easy times if able",
        demoId: "chair-sit-to-stand",
        coachHint: "Use the chair for support. Stop if anything hurts.",
      },
    ],
  },
  {
    id: "beginner-12",
    title: "Beginner no-equipment",
    minutes: 12,
    level: "beginner",
    kind: "bodyweight",
    steps: [
      {
        instruction: "March in place 1 minute",
        demoId: "beginner-march",
        holdSeconds: 60,
        coachHint: "Tap Next when you're ready to move on.",
      },
      {
        instruction: "Wall push-ups or knee push-ups × 8",
        demoId: "beginner-wall-pushups",
        coachHint: "Eight easy reps. Quality over speed.",
      },
      {
        instruction: "Bodyweight squats × 8 (shallow OK)",
        demoId: "beginner-squats",
        coachHint: "Shallow range is fine. Eight comfortable reps.",
      },
      {
        instruction: "Side steps left and right, 45 seconds",
        demoId: "beginner-side-steps",
        holdSeconds: 45,
        coachHint: "Tap Next when finished.",
      },
      {
        instruction: "Cool down stretch, breathe easy",
        demoId: "beginner-cool-stretch",
        holdSeconds: 10,
        coachHint: "Hold gently and breathe.",
      },
    ],
  },
];

export function moveStepText(step: MoveStep | string): string {
  return typeof step === "string" ? step : step.instruction;
}

export function demoForStep(step: MoveStep | undefined | null): DemoClip | null {
  if (!step) return null;
  return resolveDemoClip(step.demoId);
}

export function demoForBreathing(pattern: BreathingPattern | undefined | null): DemoClip | null {
  if (!pattern?.demoId) return null;
  return resolveDemoClip(pattern.demoId);
}

export type WellnessRec = {
  title: string;
  reason: string;
  pillar: WellnessPillar;
  path: string;
};

export type DayProgress = {
  date: string;
  mood?: MoodId;
  moveMinutes: number;
  water: boolean;
  /** Cups logged today toward the water goal. */
  waterCups: number;
  sleepRoutine: boolean;
  mindfulMinutes: number;
  habitsDone: HabitId[];
  sleepScore?: 1 | 2 | 3 | 4 | 5;
};

/** Presentation used for the YAJ Wellness Coach avatar (not medical sex). */
export type WellnessFigure = "woman" | "man";

/** Inclusive skin tones for the reusable coach avatar. */
export type WellnessSkinTone = "porcelain" | "warm" | "medium" | "rich" | "deep";

export const WELLNESS_SKIN_TONES: { id: WellnessSkinTone; label: string; swatch: string }[] = [
  { id: "porcelain", label: "Porcelain", swatch: "#e6c4a8" },
  { id: "warm", label: "Warm", swatch: "#c9956c" },
  { id: "medium", label: "Medium", swatch: "#a8896c" },
  { id: "rich", label: "Rich", swatch: "#8b5e3c" },
  { id: "deep", label: "Deep", swatch: "#5c3a24" },
];

export type WellnessHealthProfile = {
  figure: WellnessFigure;
  skinTone: WellnessSkinTone;
  age?: number;
  /** Weight in pounds (optional; used for gentle goal context). */
  weightLbs?: number;
  bedtime?: string; // "22:30"
  waterGoalCups: number;
  notifyWater: boolean;
  notifyBedtime: boolean;
};

export type WellnessState = {
  habits: HabitId[];
  days: Record<string, DayProgress>;
  lastSound?: SleepSoundId;
  /** True after the Go landing + basic health form. */
  onboarded: boolean;
  profile: WellnessHealthProfile | null;
};

const STORAGE_KEY = "yaj_wellness_v1";

export const DEFAULT_HEALTH_PROFILE: WellnessHealthProfile = {
  figure: "woman",
  skinTone: "medium",
  waterGoalCups: 8,
  notifyWater: true,
  notifyBedtime: true,
  bedtime: "22:30",
};

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function emptyDay(date = todayKey()): DayProgress {
  return {
    date,
    moveMinutes: 0,
    water: false,
    waterCups: 0,
    sleepRoutine: false,
    mindfulMinutes: 0,
    habitsDone: [],
  };
}

function normalizeProfile(raw: unknown): WellnessHealthProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<WellnessHealthProfile>;
  const figure = p.figure === "man" || p.figure === "woman" ? p.figure : null;
  if (!figure) return null;
  const skinTone = WELLNESS_SKIN_TONES.some((t) => t.id === p.skinTone)
    ? (p.skinTone as WellnessSkinTone)
    : "medium";
  return {
    figure,
    skinTone,
    age: typeof p.age === "number" && p.age > 0 ? Math.round(p.age) : undefined,
    weightLbs:
      typeof p.weightLbs === "number" && p.weightLbs > 0 ? Math.round(p.weightLbs) : undefined,
    bedtime: typeof p.bedtime === "string" && /^\d{2}:\d{2}$/.test(p.bedtime) ? p.bedtime : "22:30",
    waterGoalCups:
      typeof p.waterGoalCups === "number" && p.waterGoalCups > 0
        ? Math.min(20, Math.round(p.waterGoalCups))
        : 8,
    notifyWater: p.notifyWater !== false,
    notifyBedtime: p.notifyBedtime !== false,
  };
}

export function loadWellnessState(): WellnessState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { habits: ["water", "walk", "stretch"], days: {}, onboarded: false, profile: null };
    }
    const parsed = JSON.parse(raw) as WellnessState;
    const profile = normalizeProfile(parsed.profile);
    const days: Record<string, DayProgress> = {};
    for (const [k, d] of Object.entries(parsed.days || {})) {
      days[k] = {
        ...emptyDay(k),
        ...d,
        waterCups: typeof d.waterCups === "number" ? d.waterCups : d.water ? 1 : 0,
        habitsDone: [...(d.habitsDone || [])],
      };
    }
    return {
      habits: parsed.habits?.length ? parsed.habits : ["water", "walk", "stretch"],
      days,
      lastSound: parsed.lastSound,
      onboarded: Boolean(parsed.onboarded && profile),
      profile,
    };
  } catch {
    return { habits: ["water", "walk", "stretch"], days: {}, onboarded: false, profile: null };
  }
}

export function getWellnessFigure(state?: WellnessState): WellnessFigure {
  return (state || loadWellnessState()).profile?.figure ?? "woman";
}

export function getWellnessSkinTone(state?: WellnessState): WellnessSkinTone {
  return (state || loadWellnessState()).profile?.skinTone ?? "medium";
}

export function updateWellnessProfile(
  patch: Partial<WellnessHealthProfile> & { onboarded?: boolean },
): WellnessState {
  const state = loadWellnessState();
  const base = state.profile || { ...DEFAULT_HEALTH_PROFILE };
  const nextProfile = normalizeProfile({ ...base, ...patch });
  state.profile = nextProfile;
  if (patch.onboarded || nextProfile) state.onboarded = true;
  saveWellnessState(state);
  return state;
}

export function logWaterCup(delta = 1): WellnessState {
  return patchToday((day, state) => {
    const goal = state.profile?.waterGoalCups ?? 8;
    day.waterCups = Math.max(0, Math.min(goal + 4, (day.waterCups || 0) + delta));
    day.water = day.waterCups > 0;
  });
}

export const WELLNESS_UPDATED_EVENT = "yaj-wellness-updated";

export function saveWellnessState(state: WellnessState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WELLNESS_UPDATED_EVENT, { detail: state }));
    }
  } catch {
    /* ignore quota */
  }
}

export function getTodayProgress(state?: WellnessState): DayProgress {
  const s = state || loadWellnessState();
  const key = todayKey();
  return s.days[key] || emptyDay(key);
}

export function patchToday(mutator: (day: DayProgress, state: WellnessState) => void): WellnessState {
  const state = loadWellnessState();
  const key = todayKey();
  const day = {
    ...(state.days[key] || emptyDay(key)),
    habitsDone: [...(state.days[key]?.habitsDone || [])],
  };
  mutator(day, state);
  state.days[key] = day;
  saveWellnessState(state);
  return state;
}

/** Soft, non-clinical companion tips from mood + time of day. */
export function recommendForMood(mood: MoodId, hour = new Date().getHours()): WellnessRec[] {
  const evening = hour >= 20 || hour < 5;
  const morning = hour >= 5 && hour < 11;

  const byMood: Record<MoodId, WellnessRec[]> = {
    great: [
      {
        title: "Keep the momentum",
        reason: "A short walk or stretch locks in a good day.",
        pillar: "move",
        path: "/wellness/move",
      },
      {
        title: "Log a habit",
        reason: "Stack one small win while energy is high.",
        pillar: "habits",
        path: "/wellness/habits",
      },
    ],
    good: [
      {
        title: "5-minute stretch",
        reason: "Stay loose and present.",
        pillar: "move",
        path: "/wellness/move?start=stretch-5",
      },
      {
        title: "2-minute reset",
        reason: "A quick breath keeps the day steady.",
        pillar: "relax",
        path: "/wellness/relax?start=reset-2",
      },
    ],
    tired: evening
      ? [
          {
            title: "Bedtime wind-down",
            reason: "You marked tired — a longer exhale helps sleep.",
            pillar: "sleep",
            path: "/wellness/sleep?breath=wind-down",
          },
          {
            title: "Rain or soft fan",
            reason: "Low-effort sound while you settle.",
            pillar: "sleep",
            path: "/wellness/sleep",
          },
        ]
      : [
          {
            title: "Chair mobility",
            reason: "Gentle movement can lift low energy.",
            pillar: "move",
            path: "/wellness/move?start=chair-8",
          },
          {
            title: "Earlier wind-down tonight",
            reason: "Plan a softer evening for recovery.",
            pillar: "sleep",
            path: "/wellness/sleep",
          },
        ],
    stressed: [
      {
        title: "I need a 2-minute reset",
        reason: "Short breathing to lower the volume.",
        pillar: "relax",
        path: "/wellness/relax?start=reset-2",
      },
      {
        title: "Ocean sound",
        reason: "Steady audio while you unclench.",
        pillar: "sleep",
        path: "/wellness/sleep?sound=ocean-night",
      },
    ],
    anxious: [
      {
        title: "Box breath",
        reason: "Even counts give the mind something simple to hold.",
        pillar: "relax",
        path: "/wellness/relax?start=box",
      },
      {
        title: "Nature sound",
        reason: "Soft background while you breathe.",
        pillar: "sleep",
        path: "/wellness/sleep?sound=forest-birds",
      },
    ],
    low: [
      {
        title: "Easy walking plan",
        reason: "Light movement often helps more than forcing a workout.",
        pillar: "move",
        path: "/wellness/move?start=walk-10",
      },
      {
        title: "Drink water",
        reason: "One small physical check-in.",
        pillar: "habits",
        path: "/wellness/habits",
      },
    ],
  };

  const list = byMood[mood];
  if (morning && mood === "great") return list;
  return list.slice(0, 2);
}

export function timeOfDayRecs(hour = new Date().getHours()): WellnessRec[] {
  if (hour >= 20 || hour < 5) {
    return [
      {
        title: "Sleep sounds + timer",
        reason: "Evening is a good time to wind down.",
        pillar: "sleep",
        path: "/wellness/sleep",
      },
    ];
  }
  if (hour < 12) {
    return [
      {
        title: "Morning stretch",
        reason: "Start light before the day stacks up.",
        pillar: "move",
        path: "/wellness/move?start=stretch-5",
      },
    ];
  }
  return [
    {
      title: "2-minute reset",
      reason: "A midday pause keeps stress from compounding.",
      pillar: "relax",
      path: "/wellness/relax?start=reset-2",
    },
  ];
}

export const WELLNESS_DISCLAIMER =
  "YAJ Wellness is a companion for everyday routines — not a doctor. It doesn’t diagnose, treat, or replace professional care. If you’re in crisis or having an emergency, contact local emergency services or a trusted professional.";
