import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import {
  HABIT_OPTIONS,
  getTodayProgress,
  loadWellnessState,
  patchToday,
  saveWellnessState,
  type HabitId,
  type WellnessState,
} from "@/lib/wellness";

export default function WellnessHabitsPage() {
  const nav = useNavigate();
  const [state, setState] = useState<WellnessState>(() => loadWellnessState());
  const today = getTodayProgress(state);

  const streakHint = useMemo(() => {
    const done = today.habitsDone.length;
    if (done === 0) return "Pick what feels doable — zero pressure.";
    if (done === 1) return "Nice — one small check is enough.";
    return "Steady progress. You can stop whenever you want.";
  }, [today.habitsDone.length]);

  const toggleSelected = (id: HabitId) => {
    setState((prev) => {
      const has = prev.habits.includes(id);
      const habits = has ? prev.habits.filter((h) => h !== id) : [...prev.habits, id].slice(0, 5);
      const next = { ...prev, habits };
      saveWellnessState(next);
      return next;
    });
  };

  const markDone = (id: HabitId) => {
    const next = patchToday((day) => {
      if (day.habitsDone.includes(id)) {
        day.habitsDone = day.habitsDone.filter((h) => h !== id);
      } else {
        day.habitsDone = [...day.habitsDone, id];
      }
      if (id === "water") day.water = day.habitsDone.includes("water");
      if (id === "walk" || id === "stretch") {
        if (day.habitsDone.includes(id) && day.moveMinutes < 5) day.moveMinutes = 5;
      }
      if (id === "bed_earlier") day.sleepRoutine = day.habitsDone.includes("bed_earlier") || day.sleepRoutine;
      if (id === "screen_break" || id === "read") {
        if (day.habitsDone.includes(id) && day.mindfulMinutes < 1) day.mindfulMinutes = 1;
      }
    });
    setState({ ...next });
  };

  return (
    <div className="relative min-h-screen bg-[#f5f7f4] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_top,_rgba(90,140,90,0.18),_transparent_65%)]"
      />
      <header className="sticky top-0 z-20 border-b border-stone-900/5 bg-[#f5f7f4]/90 px-4 pb-3 pt-3 backdrop-blur">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">Small goals</p>
            <h1 className="text-lg font-black">Healthy habits</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-5 px-4 pt-5">
        <section className="rounded-[1.4rem] border border-stone-200/80 bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-black">Today</h2>
          <p className="mt-1 text-xs text-stone-500">{streakHint}</p>
          <div className="mt-3 space-y-2">
            {state.habits.map((id) => {
              const meta = HABIT_OPTIONS.find((h) => h.id === id);
              if (!meta) return null;
              const done = today.habitsDone.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => markDone(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${
                    done ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-stone-50/80"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      done ? "bg-teal-600 text-white" : "bg-white text-stone-300"
                    }`}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{meta.label}</p>
                    <p className="text-[11px] text-stone-500">{meta.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-black">Choose up to 5 habits</h2>
          <p className="mt-1 text-xs text-stone-500">Missed a day? Nothing turns red. Just begin again.</p>
          <div className="mt-3 space-y-2">
            {HABIT_OPTIONS.map((h) => {
              const on = state.habits.includes(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleSelected(h.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    on ? "border-teal-500 bg-teal-50/80" : "border-stone-200 bg-white/80"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{h.label}</p>
                    <p className="text-[11px] text-stone-500">{h.hint}</p>
                  </div>
                  <span className={`text-[11px] font-bold ${on ? "text-teal-700" : "text-stone-400"}`}>
                    {on ? "On" : "Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
