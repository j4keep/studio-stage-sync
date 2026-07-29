/** Wellness Phase 1 — calm routines, local-only progress. Not medical advice. */

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

export type BreathingPattern = {
  id: string;
  title: string;
  minutes: number;
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
  blurb: string;
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
  },
  {
    id: "wind-down",
    title: "Bedtime wind-down",
    minutes: 5,
    inhale: 4,
    hold: 2,
    exhale: 6,
    blurb: "Longer exhales for sleep",
  },
  {
    id: "reset-2",
    title: "2-minute reset",
    minutes: 2,
    inhale: 3,
    hold: 1,
    exhale: 5,
    blurb: "Quick stress release anytime",
  },
];

export type MoveRoutine = {
  id: string;
  title: string;
  minutes: number;
  level: "gentle" | "beginner";
  kind: "stretch" | "walk" | "chair" | "bodyweight";
  steps: string[];
};

export const MOVE_ROUTINES: MoveRoutine[] = [
  {
    id: "stretch-5",
    title: "5-minute stretch",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    steps: [
      "Roll shoulders slowly 8 times",
      "Neck tilts left and right",
      "Reach arms overhead and breathe",
      "Forward fold as far as feels easy",
      "Hip circles, then shake out legs",
    ],
  },
  {
    id: "walk-10",
    title: "Easy walking plan",
    minutes: 10,
    level: "beginner",
    kind: "walk",
    steps: [
      "Stand tall, soft knees",
      "Walk at a conversational pace",
      "Swing arms naturally",
      "Optional: 1-minute brisk finish",
      "Cool down with slow steps",
    ],
  },
  {
    id: "chair-8",
    title: "Chair mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    steps: [
      "Seated marches, 30 seconds",
      "Seated torso twists",
      "Ankle circles both sides",
      "Seated side reaches",
      "Stand and sit 6 easy times if able",
    ],
  },
  {
    id: "beginner-12",
    title: "Beginner no-equipment",
    minutes: 12,
    level: "beginner",
    kind: "bodyweight",
    steps: [
      "March in place 1 minute",
      "Wall push-ups or knee push-ups × 8",
      "Bodyweight squats × 8 (shallow OK)",
      "Glute bridge × 8",
      "Rest 30s, repeat the circuit once",
    ],
  },
];

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

export function saveWellnessState(state: WellnessState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function getTodayProgress(state: WellnessState): DayProgress {
  const key = todayKey();
  return state.days[key] || emptyDay(key);
}

export function patchToday(mutator: (day: DayProgress, state: WellnessState) => void): WellnessState {
  const state = loadWellnessState();
  const key = todayKey();
  const day = { ...(state.days[key] || emptyDay(key)) };
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
