import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Flame, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  HABIT_OPTIONS,
  getTodayProgress,
  loadWellnessState,
  patchToday,
  saveWellnessState,
  WELLNESS_UPDATED_EVENT,
  type HabitId,
  type WellnessState,
} from "@/lib/wellness";
import {
  celebrationLine,
  coachTipOfDay,
  computeHabitStreak,
  computePersonalBests,
  EATING_MEAL_CHIPS,
  HABIT_CATEGORIES,
  HABIT_COACH_TIP,
  HABIT_EMOJI,
  HEALTHY_PLATE,
  MEAL_IDEAS,
  recommendHabits,
  relativeTime,
  weekDateKeys,
  weekLabels,
  dayHadHabitWin,
} from "@/lib/wellness-habits-meta";

const FOCUS_MAX = 8;

export default function WellnessHabitsPage() {
  const nav = useNavigate();
  const [state, setState] = useState<WellnessState>(() => loadWellnessState());
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const today = getTodayProgress(state);
  const waterGoal = state.profile?.waterGoalCups ?? 8;
  const streak = useMemo(() => computeHabitStreak(state), [state]);
  const bests = useMemo(() => computePersonalBests(state), [state]);
  const weekKeys = useMemo(() => weekDateKeys(), []);
  const labels = weekLabels();
  const coachTip = useMemo(() => coachTipOfDay(), []);
  const focusHabits = state.habits.length
    ? state.habits
    : (["water", "walk", "stretch", "veggies", "gratitude"] as HabitId[]);

  const focusDone = focusHabits.filter((id) => today.habitsDone.includes(id)).length;
  const focusPct = Math.round((focusDone / Math.max(1, focusHabits.length)) * 100);

  useEffect(() => {
    const refresh = () => setState(loadWellnessState());
    window.addEventListener(WELLNESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(WELLNESS_UPDATED_EVENT, refresh);
  }, []);

  const celebrate = (key: string) => {
    setCelebrateId(key);
    window.setTimeout(() => setCelebrateId((c) => (c === key ? null : c)), 900);
    toast.message(`YAJ · ${celebrationLine()}`);
  };

  const toggleSelected = (id: HabitId) => {
    setState((prev) => {
      const has = prev.habits.includes(id);
      const habits = has
        ? prev.habits.filter((h) => h !== id)
        : [...prev.habits, id].slice(0, FOCUS_MAX);
      const next = { ...prev, habits };
      saveWellnessState(next);
      return next;
    });
  };

  const markDone = (id: HabitId, forceDone?: boolean) => {
    const wasDone = today.habitsDone.includes(id);
    const willDone = forceDone ?? !wasDone;
    const next = patchToday((day) => {
      if (willDone) {
        if (!day.habitsDone.includes(id)) day.habitsDone = [...day.habitsDone, id];
        day.habitCompletedAt = { ...(day.habitCompletedAt || {}), [id]: new Date().toISOString() };
      } else {
        day.habitsDone = day.habitsDone.filter((h) => h !== id);
      }
      if (id === "water") {
        day.water = willDone || day.waterCups > 0;
        if (willDone && day.waterCups < 1) day.waterCups = 1;
      }
      if (id === "walk" || id === "stretch" || id === "stand_up" || id === "mobility") {
        if (willDone && day.moveMinutes < 5) day.moveMinutes = 5;
      }
      if (id === "bed_earlier" || id === "wind_down" || id === "no_screens") {
        if (willDone) day.sleepRoutine = true;
      }
      if (
        id === "screen_break" ||
        id === "read" ||
        id === "meditate" ||
        id === "gratitude" ||
        id === "breathing" ||
        id === "journal"
      ) {
        if (willDone && day.mindfulMinutes < 1) day.mindfulMinutes = 1;
      }
    });
    setState({ ...next });
    if (willDone && !wasDone) celebrate(id);
  };

  const setCups = (cups: number) => {
    const clamped = Math.max(0, Math.min(waterGoal + 4, cups));
    const next = patchToday((day) => {
      day.waterCups = clamped;
      day.water = clamped > 0;
      if (clamped >= waterGoal) {
        if (!day.habitsDone.includes("water")) day.habitsDone = [...day.habitsDone, "water"];
        day.habitCompletedAt = {
          ...(day.habitCompletedAt || {}),
          water: new Date().toISOString(),
        };
      }
    });
    setState({ ...next });
    if (clamped > today.waterCups) {
      celebrate(`water-${clamped}`);
      if (clamped >= waterGoal) toast.success("8/8 — hydration goal complete");
    }
  };

  const togglePlate = (itemId: string) => {
    const next = patchToday((day) => {
      const cur = new Set(day.plateChecks || []);
      if (cur.has(itemId)) cur.delete(itemId);
      else cur.add(itemId);
      day.plateChecks = [...cur];
      if (cur.size >= 3 && !day.habitsDone.includes("balanced_plate")) {
        day.habitsDone = [...day.habitsDone, "balanced_plate"];
        day.habitCompletedAt = {
          ...(day.habitCompletedAt || {}),
          balanced_plate: new Date().toISOString(),
        };
      }
    });
    setState({ ...next });
  };

  const recommendations = recommendHabits(state, today.habitsDone, today.waterCups);

  return (
    <div className="relative min-h-screen bg-[#f3f7f5] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,140,110,0.2),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(250,204,21,0.12),transparent_40%)]"
      />
      <header className="sticky top-0 z-20 border-b border-teal-900/5 bg-[#f3f7f5]/92 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/wellness")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
              Personal wellness coach
            </p>
            <h1 className="font-display text-lg font-bold tracking-tight">Healthy Habits</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-7 px-4 pt-5">
        {/* Today's Healthy Plate */}
        <section className="overflow-hidden rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-white via-[#f4faf6] to-[#e7f5ee] p-5 shadow-[0_18px_40px_-28px_rgba(15,80,70,0.45)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800/80">
            🥗 Today’s Healthy Plate
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Gentle guidance — no calorie counting required.
          </p>
          <div className="mt-4 space-y-4">
            {HEALTHY_PLATE.map((slot) => (
              <div key={slot.id}>
                <p className="text-xs font-black text-stone-800">{slot.meal}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {slot.items.map((item) => {
                    const on = (today.plateChecks || []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          togglePlate(item.id);
                          if (!on) celebrate(item.id);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                          on
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white text-stone-600 ring-1 ring-stone-200"
                        }`}
                      >
                        {item.emoji} {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-2xl bg-white/70 px-3.5 py-3 text-sm leading-relaxed text-stone-600 ring-1 ring-emerald-100">
            <span className="font-bold text-teal-800">YAJ · </span>
            Don’t worry about being perfect today. If you can build one balanced meal, you’re already
            making progress.
          </p>
        </section>

        {/* Today's Progress */}
        <section
          className={`relative overflow-hidden rounded-[1.75rem] border border-teal-900/10 bg-gradient-to-br from-teal-800 via-emerald-900 to-stone-900 p-5 text-emerald-50 shadow-lg ${
            celebrateId === "progress" ? "habit-glow" : ""
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200/80">
            🌱 Today’s Progress
          </p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight">
            {focusDone} of {focusHabits.length} Habits Complete
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-300 to-emerald-300 transition-all duration-700"
              style={{ width: `${focusPct}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-bold">
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              {streak} Day Streak
            </span>
            <span className="text-teal-100/75">{focusPct}% complete</span>
          </div>
          <p className="mt-3 text-sm text-teal-100/80">✨ You’re building consistency.</p>
        </section>

        {/* Hydration Tracker */}
        <section className="rounded-[1.6rem] border border-sky-100 bg-gradient-to-br from-white to-sky-50/80 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-2xl">💧</p>
              <h2 className="mt-1 font-display text-lg font-bold">Hydration Tracker</h2>
              <p className="text-xs text-stone-500">
                {today.waterCups} / {waterGoal} glasses
              </p>
            </div>
            {today.waterCups >= waterGoal ? (
              <span className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-black text-white">
                Goal ✓
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: waterGoal }, (_, i) => {
              const filled = i < today.waterCups;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={filled ? `Remove glass ${i + 1}` : `Log glass ${i + 1}`}
                  onClick={() => setCups(filled ? i : i + 1)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
                    filled
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/30 habit-pop"
                      : "bg-white text-sky-200 ring-2 ring-sky-100"
                  }`}
                >
                  {filled ? "●" : "○"}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setCups(today.waterCups + 1)}
              className="rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white"
            >
              + Glass
            </button>
            <button
              type="button"
              onClick={() => setCups(Math.max(0, today.waterCups - 1))}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
            >
              − Undo
            </button>
          </div>
        </section>

        {/* Coach tip */}
        <section className="rounded-[1.5rem] border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
            💬 YAJ Coach
          </p>
          <p className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-stone-900">
            “{coachTip}”
          </p>
        </section>

        {/* Focus habits premium cards */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Today’s Habits</h2>
              <p className="text-xs text-stone-500">Your focus list · up to {FOCUS_MAX}</p>
            </div>
            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              className="text-xs font-bold text-teal-700"
            >
              {customizeOpen ? "Done" : "Customize"}
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {focusHabits.map((id) => {
              const meta = HABIT_OPTIONS.find((h) => h.id === id);
              if (!meta) return null;
              const done = today.habitsDone.includes(id);
              const tip = HABIT_COACH_TIP[id];
              const last = relativeTime(today.habitCompletedAt?.[id]);
              const isWater = id === "water";
              return (
                <article
                  key={id}
                  className={`relative overflow-hidden rounded-[1.5rem] border p-4 shadow-sm transition ${
                    done
                      ? "border-teal-200 bg-gradient-to-br from-teal-50 to-white"
                      : "border-stone-200/80 bg-white"
                  } ${celebrateId === id ? "habit-glow" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{HABIT_EMOJI[id] || "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold tracking-tight">{meta.label}</h3>
                      <p className="text-xs text-stone-500">{meta.hint}</p>
                      {isWater ? (
                        <p className="mt-2 text-sm font-semibold text-sky-800">
                          Current: {today.waterCups} / {waterGoal}
                        </p>
                      ) : null}
                      {isWater ? (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all"
                            style={{
                              width: `${Math.min(100, (today.waterCups / waterGoal) * 100)}%`,
                            }}
                          />
                        </div>
                      ) : null}
                      {last ? (
                        <p className="mt-2 text-[11px] font-medium text-stone-400">
                          Last completed · {last}
                        </p>
                      ) : null}
                      {tip ? (
                        <p className="mt-2 text-[11px] font-semibold text-teal-700/80">
                          Coach tip · {tip}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => markDone(id)}
                    className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-black transition ${
                      done
                        ? "bg-teal-600 text-white"
                        : "bg-stone-900 text-white active:scale-[0.99]"
                    }`}
                  >
                    {done ? (
                      <>
                        <Check className="h-4 w-4" strokeWidth={3} /> Great job!
                      </>
                    ) : (
                      "Complete"
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Healthy Eating spotlight */}
        <section className="rounded-[1.6rem] border border-lime-100 bg-gradient-to-br from-white to-lime-50/60 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-lime-800/80">
            🥗 Healthy Eating
          </p>
          <h2 className="mt-1 font-display text-lg font-bold">Today’s Meals</h2>
          <p className="text-xs text-stone-500">Tap what you included — progress without pressure.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EATING_MEAL_CHIPS.map((chip) => {
              const on = today.habitsDone.includes(chip.habit);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => markDone(chip.habit)}
                  className={`rounded-2xl px-3.5 py-2.5 text-sm font-bold ${
                    on
                      ? "bg-lime-600 text-white shadow-sm"
                      : "bg-white text-stone-700 ring-1 ring-stone-200"
                  }`}
                >
                  {chip.emoji} {chip.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm font-semibold text-lime-900">
            Completion{" "}
            {Math.round(
              (EATING_MEAL_CHIPS.filter((c) => today.habitsDone.includes(c.habit)).length /
                EATING_MEAL_CHIPS.length) *
                100,
            )}
            %
          </p>
        </section>

        {/* Meal suggestions */}
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Today’s Healthy Meal Ideas
          </h2>
          <p className="text-xs text-stone-500">Suggestions only — not a meal plan you must follow.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {MEAL_IDEAS.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-sm"
              >
                <p className="text-xl">{m.emoji}</p>
                <p className="mt-1 text-sm font-black">{m.meal}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {m.items.map((item) => (
                    <li key={item} className="text-[11px] font-medium text-stone-500">
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Weekly consistency */}
        <section className="rounded-[1.5rem] border border-stone-200/80 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold tracking-tight">This Week</h2>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {weekKeys.map((key, i) => {
              const win = dayHadHabitWin(state, key);
              const isToday = key === today.date || key === todayKeySafe();
              return (
                <div key={key} className="text-center">
                  <p className="text-[10px] font-bold text-stone-400">{labels[i]}</p>
                  <div
                    className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${
                      win
                        ? "bg-teal-600 text-white"
                        : isToday
                          ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                          : "bg-stone-100 text-stone-300"
                    }`}
                  >
                    {win ? "✔" : "○"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Personal bests */}
        <section className="rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800/80">
            🏆 Personal Bests
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <BestCard icon={Trophy} label="Longest Streak" value={`${bests.longestStreak} Days`} />
            <BestCard
              icon={Flame}
              label="Most Walking"
              value={`${bests.mostMoveMinutes || 0} min`}
            />
            <BestCard icon={Sparkles} label="Water Goal" value={`${bests.waterGoalDays} Days`} />
            <BestCard
              icon={Trophy}
              label="Healthy Meals"
              value={`${bests.healthyMealDays} Days`}
            />
          </div>
        </section>

        {/* Categories */}
        <section className="space-y-5">
          <h2 className="font-display text-lg font-bold tracking-tight">Habit Categories</h2>
          {HABIT_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="text-sm font-black text-stone-800">
                {cat.emoji} {cat.label}
              </p>
              <div className="mt-2 space-y-2">
                {cat.habits.map((id) => {
                  const meta = HABIT_OPTIONS.find((h) => h.id === id);
                  if (!meta) return null;
                  const done = today.habitsDone.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => markDone(id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                        done
                          ? "border-teal-200 bg-teal-50/90"
                          : "border-stone-200/80 bg-white/90"
                      }`}
                    >
                      <span className="text-xl">{HABIT_EMOJI[id]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{meta.label}</span>
                        <span className="block text-[11px] text-stone-500">{meta.hint}</span>
                      </span>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          done ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-300"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Smart recommendations */}
        <section className="rounded-[1.5rem] border border-teal-200/70 bg-gradient-to-br from-teal-50 to-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
            Recommended Today
          </p>
          <div className="mt-3 space-y-2">
            {recommendations.map((r) => (
              <button
                key={r.title}
                type="button"
                onClick={() => {
                  if (r.path) nav(r.path);
                  else if (r.habitId) markDone(r.habitId, true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 text-left ring-1 ring-teal-100"
              >
                <span>
                  <span className="block text-sm font-black text-stone-900">{r.title}</span>
                  <span className="block text-xs text-stone-500">{r.detail}</span>
                </span>
                <span className="shrink-0 text-xs font-black text-teal-700">{r.cta}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Customize focus */}
        {customizeOpen ? (
          <section className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black">Choose up to {FOCUS_MAX} focus habits</h2>
            <p className="mt-1 text-xs text-stone-500">
              Missed a day? Nothing turns red. Just begin again.
            </p>
            <div className="mt-3 space-y-2">
              {HABIT_OPTIONS.map((h) => {
                const on = state.habits.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleSelected(h.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                      on ? "border-teal-500 bg-teal-50/80" : "border-stone-200 bg-stone-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{HABIT_EMOJI[h.id]}</span>
                      <div>
                        <p className="text-sm font-bold">{h.label}</p>
                        <p className="text-[11px] text-stone-500">{h.hint}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold ${on ? "text-teal-700" : "text-stone-400"}`}>
                      {on ? "On" : "Add"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <style>{`
        .habit-glow { animation: habitGlow 0.9s ease; }
        .habit-pop { animation: habitPop 0.35s ease; }
        @keyframes habitGlow {
          0% { box-shadow: 0 0 0 0 rgba(45,212,191,0.0); }
          40% { box-shadow: 0 0 0 6px rgba(45,212,191,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(45,212,191,0); }
        }
        @keyframes habitPop {
          0% { transform: scale(0.85); }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function BestCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 px-3 py-3 ring-1 ring-amber-100">
      <Icon className="h-3.5 w-3.5 text-amber-600" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-sm font-black text-stone-900">{value}</p>
    </div>
  );
}

function todayKeySafe() {
  return new Date().toISOString().slice(0, 10);
}
