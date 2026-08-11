import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Flame, Footprints, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MoveCoachSession from "@/components/wellness/MoveCoachSession";
import MoveWorkoutCard from "@/components/wellness/MoveWorkoutCard";
import WorkoutMusicCard from "@/components/wellness/WorkoutMusicCard";
import { workoutMusic } from "@/lib/workout-music";

import {
  COACH_ROUTINES,
  getCoachRoutine,
  type MoveCategoryId,
} from "@/lib/wellness-move-coach";
import {
  filterCoachRoutines,
  MOVE_CATEGORIES,
  moveStreakDays,
  readLastRoutineId,
  readMoveDayStats,
  recommendedRoutines,
} from "@/lib/wellness-move-meta";
import { getTodayProgress, patchToday, type MoodId } from "@/lib/wellness";

export default function WellnessMovePage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [category, setCategory] = useState<MoveCategoryId | "all">("all");
  const [query, setQuery] = useState("");
  const [dayStats, setDayStats] = useState(() => readMoveDayStats());
  const mood = getTodayProgress().mood as MoodId | undefined;
  const streak = moveStreakDays();
  const lastId = readLastRoutineId();

  const active = useMemo(() => getCoachRoutine(activeId), [activeId]);
  const recommended = useMemo(() => recommendedRoutines(mood), [mood]);
  const filtered = useMemo(
    () => filterCoachRoutines(query, category),
    [query, category],
  );

  useEffect(() => {
    const start = params.get("start");
    if (start && COACH_ROUTINES.some((r) => r.id === start)) setActiveId(start);
  }, [params]);

  // Leaving the Move page (or backgrounding the app) must kill workout music.
  useEffect(() => {
    const stop = () => workoutMusic.stop();
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);


  const startRoutine = (id: string) => {
    setActiveId(id);
    setSessionNonce((n) => n + 1);
  };

  return (
    <div className="relative min-h-screen bg-[#f3f7f5] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,140,110,0.22),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(45,212,191,0.12),transparent_40%)]"
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
              Personal AI coach
            </p>
            <h1 className="font-display text-lg font-bold tracking-tight">Move</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-7 px-4 pt-5">
        {/* Today’s Movement */}
        <section className="rounded-[1.5rem] border border-teal-900/10 bg-gradient-to-br from-white to-[#eaf6f1] p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700/80">
            Today’s Movement
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Stat
              icon={Footprints}
              label="Minutes"
              value={`${dayStats.minutes || getTodayProgress().moveMinutes}`}
            />
            <Stat icon={Flame} label="Calories" value={`${dayStats.calories}`} />
            <Stat icon={Sparkles} label="Workouts" value={`${dayStats.workouts}`} />
            <Stat icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
          </div>
        </section>

        <WorkoutMusicCard />

        {/* Search */}
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises… neck, knees, walking"
            className="h-12 w-full rounded-2xl border border-stone-200 bg-white/90 pl-10 pr-4 text-sm font-medium outline-none ring-teal-500/30 placeholder:text-stone-400 focus:ring-2"
          />
        </label>

        {/* Categories */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
          {MOVE_CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  on
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-stone-600 ring-1 ring-stone-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Recommended */}
        {!query && category === "all" ? (
          <section>
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Recommended Today</h2>
                <p className="mt-0.5 text-xs text-stone-500">Based on your recent activity</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {recommended.map((r) => (
                <MoveWorkoutCard
                  key={`rec-${r.id}`}
                  routine={r}
                  compact
                  onStart={() => startRoutine(r.id)}
                />
              ))}
            </div>
            {lastId && getCoachRoutine(lastId) ? (
              <button
                type="button"
                onClick={() => startRoutine(lastId)}
                className="mt-3 flex w-full items-center justify-between rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-teal-700">
                    Continue
                  </span>
                  <span className="text-sm font-black text-stone-900">
                    {getCoachRoutine(lastId)?.title}
                  </span>
                </span>
                <span className="text-xs font-black text-teal-700">Resume →</span>
              </button>
            ) : null}
          </section>
        ) : null}

        {/* Library */}
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">Exercise Library</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {filtered.length} workout{filtered.length === 1 ? "" : "s"}
            {query ? ` for “${query}”` : ""}
          </p>
          <div className="mt-3 space-y-3.5">
            {filtered.map((r) => (
              <MoveWorkoutCard key={r.id} routine={r} onStart={() => startRoutine(r.id)} />
            ))}
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 bg-white/70 px-4 py-8 text-center text-sm text-stone-500">
                No workouts match that search. Try neck, walking, or balance.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {active && (
        <MoveCoachSession
          key={`${active.id}-${sessionNonce}`}
          routine={active}
          onClose={() => {
            setActiveId(null);
            setDayStats(readMoveDayStats());
          }}
          onProgress={(mins) => {
            patchToday((d) => {
              d.moveMinutes += mins;
            });
            toast.success(`${mins} min movement logged`);
            setDayStats(readMoveDayStats());
          }}
          onPickAnother={() => {
            setActiveId(null);
            setDayStats(readMoveDayStats());
          }}
          onHome={() => {
            setActiveId(null);
            nav("/wellness");
          }}
          onStartAnother={(id) => startRoutine(id)}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-teal-900/5">
      <Icon className="h-3.5 w-3.5 text-teal-600" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-lg font-black text-stone-900">{value}</p>
    </div>
  );
}
