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

export type SleepSoundId = "rain" | "ocean" | "fan" | "white" | "nature";

export const SLEEP_SOUNDS: {
  id: SleepSoundId;
  label: string;
  blurb: string;
}[] = [
  { id: "rain", label: "Rain", blurb: "Soft rainfall for wind-down" },
  { id: "ocean", label: "Ocean", blurb: "Steady waves" },
  { id: "fan", label: "Fan", blurb: "Gentle hum" },
  { id: "white", label: "White noise", blurb: "Even, calming static" },
  { id: "nature", label: "Nature", blurb: "Light forest air" },
];

/**
 * Move step references a catalog demo id (`video_url` resolved at play time).
 * Swap catalog URLs later for AI / certified / creator clips — UI unchanged.
 */
export type MoveStep = {
  instruction: string;
  demoId: WellnessDemoId;
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
    title: "Box breath",
    minutes: 3,
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdOut: 4,
    blurb: "Even rhythm to settle the mind",
    demoId: "breath-box",
  },
  {
    id: "wind-down",
    title: "Bedtime wind-down",
    minutes: 5,
    inhale: 4,
    hold: 2,
    exhale: 6,
    blurb: "Longer exhales for sleep",
    demoId: "breath-wind-down",
  },
  {
    id: "reset-2",
    title: "2-minute reset",
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

/** Each step points at a YAJ catalog demo (matched motion + future video_url). */
export const MOVE_ROUTINES: MoveRoutine[] = [
  {
    id: "stretch-5",
    title: "5-minute stretch",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    steps: [
      { instruction: "Roll shoulders slowly 8 times", demoId: "stretch-shoulders" },
      { instruction: "Neck tilts left and right", demoId: "stretch-neck-tilts" },
      { instruction: "Reach arms overhead and breathe", demoId: "stretch-arms-overhead" },
      { instruction: "Forward fold as far as feels easy", demoId: "stretch-forward-fold" },
      { instruction: "Hip circles, then shake out legs", demoId: "stretch-hip-circles" },
    ],
  },
  {
    id: "walk-10",
    title: "Easy walking plan",
    minutes: 10,
    level: "beginner",
    kind: "walk",
    steps: [
      { instruction: "Stand tall, soft knees", demoId: "walk-stand-tall" },
      { instruction: "Walk at a conversational pace", demoId: "walk-naturally" },
      { instruction: "Swing arms naturally", demoId: "walk-swing-arms" },
      { instruction: "Optional: 1-minute brisk finish", demoId: "walk-brisk-finish" },
      { instruction: "Cool down with slow steps", demoId: "walk-cool-down" },
    ],
  },
  {
    id: "chair-8",
    title: "Chair mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    steps: [
      { instruction: "Seated marches, 30 seconds", demoId: "chair-seated-marches" },
      { instruction: "Seated torso twists", demoId: "chair-torso-twists" },
      { instruction: "Ankle circles both sides", demoId: "chair-ankle-circles" },
      { instruction: "Seated side reaches", demoId: "chair-side-reaches" },
      { instruction: "Stand and sit 6 easy times if able", demoId: "chair-sit-to-stand" },
    ],
  },
  {
    id: "beginner-12",
    title: "Beginner no-equipment",
    minutes: 12,
    level: "beginner",
    kind: "bodyweight",
    steps: [
      { instruction: "March in place 1 minute", demoId: "beginner-march" },
      { instruction: "Wall push-ups or knee push-ups × 8", demoId: "beginner-wall-pushups" },
      { instruction: "Bodyweight squats × 8 (shallow OK)", demoId: "beginner-squats" },
      { instruction: "Side steps left and right, 45 seconds", demoId: "beginner-side-steps" },
      { instruction: "Cool down stretch, breathe easy", demoId: "beginner-cool-stretch" },
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
  sleepRoutine: boolean;
  mindfulMinutes: number;
  habitsDone: HabitId[];
  sleepScore?: 1 | 2 | 3 | 4 | 5;
};

export type WellnessState = {
  habits: HabitId[];
  days: Record<string, DayProgress>;
  lastSound?: SleepSoundId;
};

const STORAGE_KEY = "yaj_wellness_v1";

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function emptyDay(date = todayKey()): DayProgress {
  return {
    date,
    moveMinutes: 0,
    water: false,
    sleepRoutine: false,
    mindfulMinutes: 0,
    habitsDone: [],
  };
}

export function loadWellnessState(): WellnessState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { habits: ["water", "walk", "stretch"], days: {} };
    const parsed = JSON.parse(raw) as WellnessState;
    return {
      habits: parsed.habits?.length ? parsed.habits : ["water", "walk", "stretch"],
      days: parsed.days || {},
      lastSound: parsed.lastSound,
    };
  } catch {
    return { habits: ["water", "walk", "stretch"], days: {} };
  }
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
        path: "/wellness/sleep?sound=ocean",
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
        path: "/wellness/sleep?sound=nature",
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
