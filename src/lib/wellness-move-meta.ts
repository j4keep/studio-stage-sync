import type { MoodId } from "@/lib/wellness";
import {
  COACH_ROUTINES,
  estimateCalories,
  getCoachRoutine,
  readMoveStreak,
  type CoachRoutine,
  type MoveCategoryId,
} from "@/lib/wellness-move-coach";

export const MOVE_CATEGORIES: { id: MoveCategoryId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stretch", label: "Stretch" },
  { id: "walking", label: "Walking" },
  { id: "strength", label: "Strength" },
  { id: "mobility", label: "Mobility" },
  { id: "balance", label: "Balance" },
  { id: "cardio", label: "Cardio" },
  { id: "recovery", label: "Recovery" },
  { id: "seniors", label: "Seniors" },
  { id: "office", label: "Office" },
  { id: "chair", label: "Chair Exercises" },
];

export function filterCoachRoutines(
  query: string,
  category: MoveCategoryId | "all",
): CoachRoutine[] {
  const q = query.trim().toLowerCase();
  return COACH_ROUTINES.filter((r) => {
    if (category !== "all" && !r.categories.includes(category)) return false;
    if (!q) return true;
    const hay = [
      r.title,
      r.blurb,
      r.level,
      r.kind,
      ...r.categories,
      ...r.targets,
      ...r.equipment,
      ...r.tags,
      ...r.steps.map((s) => s.title),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function levelLabel(level: CoachRoutine["level"]): string {
  if (level === "gentle") return "Gentle";
  if (level === "moderate") return "Moderate";
  return "Beginner";
}

export function levelStars(level: CoachRoutine["level"]): string {
  if (level === "gentle") return "★★☆☆☆";
  if (level === "moderate") return "★★★★☆";
  return "★★★☆☆";
}

const LAST_KEY = "yaj_wellness_move_last_v1";
const DAY_KEY = "yaj_wellness_move_day_stats_v1";

export type MoveDayStats = {
  date: string;
  minutes: number;
  calories: number;
  workouts: number;
};

export function readLastRoutineId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function saveLastRoutineId(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readMoveDayStats(today = new Date().toISOString().slice(0, 10)): MoveDayStats {
  try {
    const raw = localStorage.getItem(DAY_KEY);
    if (!raw) return { date: today, minutes: 0, calories: 0, workouts: 0 };
    const parsed = JSON.parse(raw) as MoveDayStats;
    if (parsed.date !== today) return { date: today, minutes: 0, calories: 0, workouts: 0 };
    return parsed;
  } catch {
    return { date: today, minutes: 0, calories: 0, workouts: 0 };
  }
}

export function bumpMoveDayStats(minutes: number, calories: number, routineId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const cur = readMoveDayStats(today);
  const next: MoveDayStats = {
    date: today,
    minutes: cur.minutes + minutes,
    calories: cur.calories + calories,
    workouts: cur.workouts + 1,
  };
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  saveLastRoutineId(routineId);
  return next;
}

export function recommendedRoutines(mood?: MoodId | null): CoachRoutine[] {
  const hour = new Date().getHours();
  const ids: string[] = [];
  if (hour < 11) ids.push("morning-stretch", "post-meal-walk", "desk-stretch");
  else if (hour < 17) ids.push("office-neck-reset", "mobility-hips", "walk-10");
  else ids.push("evening-stretch", "recovery-flow", "stretch-5");

  if (mood === "tired" || mood === "low") ids.unshift("recovery-walk", "chair-8");
  if (mood === "stressed" || mood === "anxious") ids.unshift("neck-relief", "shoulder-release");

  const last = readLastRoutineId();
  if (last) ids.unshift(last);

  const seen = new Set<string>();
  const out: CoachRoutine[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const r = getCoachRoutine(id);
    if (!r) continue;
    seen.add(id);
    out.push(r);
    if (out.length >= 4) break;
  }
  if (out.length < 3) {
    for (const r of COACH_ROUTINES) {
      if (seen.has(r.id)) continue;
      out.push(r);
      if (out.length >= 4) break;
    }
  }
  return out;
}

export function suggestNextRoutine(currentId: string): CoachRoutine | null {
  const cur = getCoachRoutine(currentId);
  if (!cur) return COACH_ROUTINES[0] ?? null;
  const sameCat = COACH_ROUTINES.find(
    (r) => r.id !== currentId && r.categories.some((c) => cur.categories.includes(c)),
  );
  return sameCat || COACH_ROUTINES.find((r) => r.id !== currentId) || null;
}

export function completionCoachLine(routine: CoachRoutine, minutes: number): string {
  const mins = Math.max(1, minutes);
  return `Nice work. You moved for ${mins} minute${mins === 1 ? "" : "s"} today — that's a promise you kept to yourself. Want to do one more stretch, or head back?`;
}

export function workoutCalories(routine: CoachRoutine): number {
  return estimateCalories(routine, routine.minutes);
}

export function moveStreakDays(): number {
  return readMoveStreak().streak;
}
