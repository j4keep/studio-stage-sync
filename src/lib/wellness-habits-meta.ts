import {
  HABIT_OPTIONS,
  todayKey,
  type HabitId,
  type WellnessState,
} from "@/lib/wellness";

export type HabitCategoryId = "hydration" | "movement" | "nutrition" | "sleep" | "mind";

export const HABIT_CATEGORIES: {
  id: HabitCategoryId;
  label: string;
  emoji: string;
  habits: HabitId[];
}[] = [
  {
    id: "hydration",
    label: "Hydration",
    emoji: "💧",
    habits: ["water", "electrolytes"],
  },
  {
    id: "movement",
    label: "Movement",
    emoji: "🚶",
    habits: ["walk", "stretch", "stand_up", "mobility"],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    emoji: "🥗",
    habits: [
      "healthy_breakfast",
      "veggies",
      "fruit",
      "lean_protein",
      "healthy_snacks",
      "meal_prep",
      "no_sugary_drinks",
      "less_processed",
      "eat_slowly",
      "balanced_plate",
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    emoji: "🌙",
    habits: ["wind_down", "no_screens", "bed_earlier"],
  },
  {
    id: "mind",
    label: "Mind",
    emoji: "🧘",
    habits: ["meditate", "gratitude", "breathing", "read", "journal", "screen_break"],
  },
];

export const HABIT_EMOJI: Record<HabitId, string> = {
  water: "💧",
  electrolytes: "⚡",
  walk: "🚶",
  stretch: "🧘",
  stand_up: "🧍",
  mobility: "🔄",
  veggies: "🥦",
  fruit: "🍓",
  lean_protein: "🍗",
  healthy_breakfast: "🥣",
  no_sugary_drinks: "🚫",
  healthy_snacks: "🥜",
  less_processed: "🌾",
  eat_slowly: "🐢",
  balanced_plate: "🥗",
  meal_prep: "🍱",
  bed_earlier: "🛏️",
  wind_down: "🌙",
  no_screens: "📵",
  screen_break: "👀",
  meditate: "🧘‍♀️",
  gratitude: "✨",
  breathing: "🌬️",
  read: "📖",
  journal: "📝",
};

export const HABIT_COACH_TIP: Partial<Record<HabitId, string>> = {
  water: "Water first. Coffee second.",
  walk: "A short walk still counts as a promise kept.",
  stretch: "Move only within a comfortable range.",
  veggies: "One colorful serving is a win.",
  fruit: "Fruit is a habit, not a treat.",
  balanced_plate: "Half vegetables when you can — progress over perfect.",
  healthy_breakfast: "Protein + fruit beats skipping.",
  bed_earlier: "Dim the lights 20 minutes early.",
  meditate: "Two calm minutes are enough.",
  gratitude: "Name one small good thing.",
};

export const COACH_ROTATING_TIPS = [
  "Small habits beat perfect days.",
  "Water first. Coffee second.",
  "One healthy meal is better than none.",
  "Don’t worry about being perfect today.",
  "Consistency is quieter than motivation — and stronger.",
  "If you can build one balanced meal, you’re already making progress.",
  "Missed a check? Begin again without drama.",
  "Your future self loves the tiny choices.",
];

export function coachTipOfDay(d = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return COACH_ROTATING_TIPS[day % COACH_ROTATING_TIPS.length];
}

export const CELEBRATION_LINES = [
  "Nice work.",
  "You’re building momentum.",
  "One habit at a time.",
  "That counts.",
  "Quiet win — keep going.",
];

export function celebrationLine(): string {
  return CELEBRATION_LINES[Math.floor(Math.random() * CELEBRATION_LINES.length)];
}

export type MealIdea = {
  id: string;
  meal: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  emoji: string;
  items: string[];
};

export const MEAL_IDEAS: MealIdea[] = [
  {
    id: "breakfast",
    meal: "Breakfast",
    emoji: "🥣",
    items: ["Greek yogurt", "Blueberries", "Granola"],
  },
  {
    id: "lunch",
    meal: "Lunch",
    emoji: "🥗",
    items: ["Grilled chicken", "Brown rice", "Mixed vegetables"],
  },
  {
    id: "dinner",
    meal: "Dinner",
    emoji: "🍽",
    items: ["Salmon", "Sweet potato", "Broccoli"],
  },
  {
    id: "snack",
    meal: "Snack",
    emoji: "🥜",
    items: ["Apple", "Almonds"],
  },
];

export type PlateSlot = {
  id: string;
  meal: string;
  items: { id: string; emoji: string; label: string }[];
};

export const HEALTHY_PLATE: PlateSlot[] = [
  {
    id: "breakfast",
    meal: "Breakfast",
    items: [
      { id: "b-protein", emoji: "🍳", label: "Protein" },
      { id: "b-fruit", emoji: "🍓", label: "Fruit" },
      { id: "b-water", emoji: "☕", label: "Water" },
    ],
  },
  {
    id: "lunch",
    meal: "Lunch",
    items: [
      { id: "l-veg", emoji: "🥗", label: "Half vegetables" },
      { id: "l-protein", emoji: "🍗", label: "Lean protein" },
      { id: "l-grain", emoji: "🌾", label: "Whole grain" },
    ],
  },
  {
    id: "dinner",
    meal: "Dinner",
    items: [
      { id: "d-veg", emoji: "🥦", label: "Vegetables" },
      { id: "d-protein", emoji: "🐟", label: "Protein" },
      { id: "d-carb", emoji: "🍠", label: "Healthy carb" },
    ],
  },
];

export const EATING_MEAL_CHIPS = [
  { id: "chip-fruit", emoji: "🥝", label: "Fruit", habit: "fruit" as HabitId },
  { id: "chip-veg", emoji: "🥦", label: "Vegetables", habit: "veggies" as HabitId },
  { id: "chip-protein", emoji: "🍗", label: "Protein", habit: "lean_protein" as HabitId },
  { id: "chip-grain", emoji: "🌾", label: "Whole Grain", habit: "balanced_plate" as HabitId },
];

export function habitMeta(id: HabitId) {
  return HABIT_OPTIONS.find((h) => h.id === id);
}

/** Monday-start week keys YYYY-MM-DD */
export function weekDateKeys(d = new Date()): string[] {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return todayKey(x);
  });
}

export function weekLabels(): string[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

export function dayHadHabitWin(state: WellnessState, dateKey: string): boolean {
  const day = state.days[dateKey];
  if (!day) return false;
  return (day.habitsDone?.length || 0) > 0 || (day.waterCups || 0) > 0;
}

export function computeHabitStreak(state: WellnessState): number {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  // If today empty, start from yesterday
  if (!dayHadHabitWin(state, todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 60; i++) {
    const key = todayKey(cursor);
    if (!dayHadHabitWin(state, key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computePersonalBests(state: WellnessState): {
  longestStreak: number;
  waterGoalDays: number;
  healthyMealDays: number;
  mostMoveMinutes: number;
} {
  let longest = 0;
  let run = 0;
  const keys = Object.keys(state.days).sort();
  for (const key of keys) {
    if (dayHadHabitWin(state, key)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  longest = Math.max(longest, computeHabitStreak(state));

  let waterGoalDays = 0;
  let healthyMealDays = 0;
  let mostMoveMinutes = 0;
  const goal = state.profile?.waterGoalCups ?? 8;
  const foodHabits: HabitId[] = [
    "veggies",
    "fruit",
    "lean_protein",
    "healthy_breakfast",
    "balanced_plate",
    "healthy_snacks",
  ];
  for (const day of Object.values(state.days)) {
    if ((day.waterCups || 0) >= goal) waterGoalDays += 1;
    if (day.habitsDone?.some((h) => foodHabits.includes(h))) healthyMealDays += 1;
    mostMoveMinutes = Math.max(mostMoveMinutes, day.moveMinutes || 0);
  }

  return {
    longestStreak: longest,
    waterGoalDays,
    healthyMealDays,
    mostMoveMinutes,
  };
}

export type HabitRecommendation = {
  title: string;
  detail: string;
  habitId?: HabitId;
  path?: string;
  cta: string;
};

export function recommendHabits(
  state: WellnessState,
  done: HabitId[],
  waterCups: number,
): HabitRecommendation[] {
  const goal = state.profile?.waterGoalCups ?? 8;
  const out: HabitRecommendation[] = [];
  if (waterCups < Math.min(2, goal)) {
    out.push({
      title: "You haven’t had much water recently",
      detail: "Drink one glass now.",
      habitId: "water",
      cta: "Start →",
    });
  }
  if (!done.includes("stretch")) {
    out.push({
      title: "You haven’t stretched today",
      detail: "5-minute stretch resets your body.",
      habitId: "stretch",
      path: "/wellness/move?start=stretch-5",
      cta: "Start →",
    });
  }
  if (!done.includes("veggies") && !done.includes("fruit")) {
    out.push({
      title: "Add one colorful serving",
      detail: "Fruit or vegetables — either counts.",
      habitId: "veggies",
      cta: "Complete →",
    });
  }
  if (!done.includes("walk") && (state.days[todayKey()]?.moveMinutes || 0) < 5) {
    out.push({
      title: "A short walk is waiting",
      detail: "Even 10 minutes helps.",
      habitId: "walk",
      path: "/wellness/move?start=walk-10",
      cta: "Start →",
    });
  }
  if (!out.length) {
    out.push({
      title: "You’re on a good track",
      detail: "Keep the momentum with one more tiny habit.",
      cta: "Keep going →",
    });
  }
  return out.slice(0, 3);
}

export function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return "Earlier today";
}
