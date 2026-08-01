import {
  type DayProgress,
  type MoodId,
  type WellnessRec,
  type WellnessState,
} from "@/lib/wellness";
import { computeHabitStreak } from "@/lib/wellness-habits-meta";

export type ScorePart = {
  id: string;
  label: string;
  emoji: string;
  points: number;
  max: number;
};

export type WellnessScore = {
  total: number;
  parts: ScorePart[];
  label: string;
  nudge: string;
};

const FOOD_HABITS = new Set([
  "veggies",
  "fruit",
  "lean_protein",
  "healthy_breakfast",
  "balanced_plate",
  "healthy_snacks",
  "meal_prep",
  "no_sugary_drinks",
  "less_processed",
  "eat_slowly",
]);

export function timeGreeting(d = new Date()): { eyebrow: string; hello: string } {
  const h = d.getHours();
  if (h < 5) return { eyebrow: "Late night", hello: "Good evening" };
  if (h < 12) return { eyebrow: "Good morning", hello: "Good morning" };
  if (h < 17) return { eyebrow: "Good afternoon", hello: "Good afternoon" };
  if (h < 21) return { eyebrow: "Good evening", hello: "Good evening" };
  return { eyebrow: "Winding down", hello: "Good evening" };
}

export function firstNameFromDisplay(name?: string | null, email?: string | null): string {
  const raw = (name || "").trim() || (email || "").split("@")[0] || "";
  if (!raw) return "";
  const first = raw.split(/[\s._-]+/)[0];
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function computeWellnessScore(
  state: WellnessState,
  today: DayProgress,
): WellnessScore {
  const waterGoal = state.profile?.waterGoalCups ?? 8;
  const moveGoal = 20;
  const mindGoal = 30;

  const sleep = today.sleepRoutine ? 25 : today.sleepScore && today.sleepScore >= 3 ? 12 : 0;
  const movement = Math.min(20, Math.round(((today.moveMinutes || 0) / moveGoal) * 20));
  const hydration = Math.min(
    15,
    Math.round(((today.waterCups || (today.water ? 1 : 0)) / waterGoal) * 15),
  );
  const relaxation = Math.min(15, Math.round(((today.mindfulMinutes || 0) / mindGoal) * 15));

  const foodDone = (today.habitsDone || []).filter((h) => FOOD_HABITS.has(h)).length;
  const nutrition = foodDone >= 3 ? 15 : foodDone === 2 ? 10 : foodDone === 1 ? 6 : 0;

  const focus = state.habits.length || 3;
  const habitHits = (today.habitsDone || []).length;
  const habits = Math.min(10, Math.round((habitHits / focus) * 10));

  const parts: ScorePart[] = [
    { id: "sleep", label: "Sleep", emoji: "😴", points: sleep, max: 25 },
    { id: "move", label: "Movement", emoji: "🚶", points: movement, max: 20 },
    { id: "water", label: "Hydration", emoji: "💧", points: hydration, max: 15 },
    { id: "relax", label: "Relaxation", emoji: "🧘", points: relaxation, max: 15 },
    { id: "food", label: "Nutrition", emoji: "🥗", points: nutrition, max: 15 },
    { id: "habits", label: "Habits", emoji: "🌱", points: habits, max: 10 },
  ];

  const total = parts.reduce((s, p) => s + p.points, 0);
  const label =
    total >= 90
      ? "Outstanding day"
      : total >= 75
        ? "Excellent progress"
        : total >= 55
          ? "Strong start"
          : total >= 30
            ? "Gentle progress"
            : "A fresh beginning";

  let nudge = "Small healthy choices become big changes.";
  if (nutrition < 10) {
    nudge =
      "You’re off to a strong start. Completing one healthy meal today could raise your score into the 90s.";
  } else if (hydration < 12) {
    nudge = "Drinking one more glass of water would lift your Wellness Score nicely.";
  } else if (movement < 15) {
    nudge = "A short stretch or walk could push today’s score even higher.";
  } else if (relaxation < 10) {
    nudge = "Two calm minutes of breathing would round out an already good day.";
  } else if (total >= 80) {
    nudge = "You’re doing well today. Keep the momentum soft and steady.";
  }

  return { total, parts, label, nudge };
}

export type SmartRec = WellnessRec & {
  because: string;
};

export function smartRecommendations(
  state: WellnessState,
  today: DayProgress,
  mood?: MoodId | null,
  hour = new Date().getHours(),
): SmartRec[] {
  const waterGoal = state.profile?.waterGoalCups ?? 8;
  const cups = today.waterCups || 0;
  const out: SmartRec[] = [];

  if (mood === "stressed" || mood === "anxious") {
    out.push({
      title: "Box Breathing",
      reason: "A short reset for a busy mind",
      because:
        mood === "stressed"
          ? "Because you’re feeling stressed"
          : "Because you’re feeling anxious",
      pillar: "relax",
      path: "/wellness/relax?start=box",
    });
  }

  if (mood === "tired" || mood === "low") {
    out.push({
      title: "Recovery Walk",
      reason: "Gentle movement without pressure",
      because: "Because your energy feels low",
      pillar: "move",
      path: "/wellness/move?start=recovery-walk",
    });
  }

  if (!today.sleepRoutine && (hour >= 20 || hour < 5)) {
    out.push({
      title: "Bedtime Wind Down",
      reason: "Ease into rest with guided breath",
      because: "Because your sleep routine isn’t done yet",
      pillar: "sleep",
      path: "/wellness/sleep",
    });
  }

  if (hour >= 5 && hour < 11 && today.moveMinutes < 5) {
    out.push({
      title: "5-Minute Stretch",
      reason: "Wake the body up gently",
      because: "Because a morning stretch sets the tone",
      pillar: "move",
      path: "/wellness/move?start=stretch-5",
    });
  }

  if (hour >= 11 && hour < 17 && today.moveMinutes < 5) {
    out.push({
      title: "Office Mobility",
      reason: "Undo sitting stiffness",
      because: "You’ve been sitting awhile",
      pillar: "move",
      path: "/wellness/move?start=desk-break-5",
    });
  }

  if (cups < Math.min(2, waterGoal)) {
    out.push({
      title: "Hydration Reminder",
      reason: "Drink one glass now",
      because: "Because your water is still low today",
      pillar: "habits",
      path: "/wellness/habits",
    });
  }

  if (!today.habitsDone.some((h) => FOOD_HABITS.has(h))) {
    out.push({
      title: "Build a Balanced Plate",
      reason: "One colorful meal — no calorie counting",
      because: "Because nutrition hasn’t been checked in yet",
      pillar: "habits",
      path: "/wellness/habits",
    });
  }

  if (today.mindfulMinutes < 1 && (mood === "stressed" || mood === "anxious" || hour >= 18)) {
    out.push({
      title: "Quick Mental Reset",
      reason: "Two calm minutes with YAJ",
      because: "Because a short reset would help right now",
      pillar: "relax",
      path: "/wellness/relax",
    });
  }

  // Deduplicate by path, keep first 4
  const seen = new Set<string>();
  const unique: SmartRec[] = [];
  for (const r of out) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    unique.push(r);
    if (unique.length >= 4) break;
  }

  if (!unique.length) {
    unique.push({
      title: "Take a Moment",
      reason: "A soft 2-minute reset",
      because: "Because a tiny pause still counts",
      pillar: "relax",
      path: "/wellness/relax?start=reset-2",
    });
  }

  return unique;
}

export function coachSummary(
  state: WellnessState,
  today: DayProgress,
  score: WellnessScore,
): string {
  const streak = computeHabitStreak(state);
  const bits: string[] = [];

  if (today.sleepRoutine) bits.push("You’ve already completed your sleep routine.");
  if (today.moveMinutes > 0) bits.push(`You moved for ${today.moveMinutes} minute${today.moveMinutes === 1 ? "" : "s"}.`);
  if ((today.waterCups || 0) > 0) {
    bits.push(`Hydration is at ${today.waterCups}/${state.profile?.waterGoalCups ?? 8}.`);
  }
  if (streak > 1) bits.push(`You’re on a ${streak}-day streak.`);

  const lead = bits[0]
    ? `You’re doing well today. ${bits[0]}`
    : "Welcome back. Today is a fresh chance to take care of yourself.";

  const waterGoal = state.profile?.waterGoalCups ?? 8;
  const cups = today.waterCups || 0;
  if (cups < waterGoal) {
    const nextScore = Math.min(100, score.total + Math.max(1, Math.round(15 / waterGoal)));
    return `${lead} Drinking one more glass of water would bring your Wellness Score toward ${nextScore}.`;
  }
  if (score.parts.find((p) => p.id === "food")!.points < 10) {
    return `${lead} One balanced meal could lift your score into the next range.`;
  }
  return `${lead} ${score.nudge}`;
}
