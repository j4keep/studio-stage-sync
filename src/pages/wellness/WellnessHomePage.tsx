import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Droplets,
  Footprints,
  LayoutDashboard,
  Leaf,
  Moon,
  Sparkles,
  Sprout,
} from "lucide-react";
import WellnessDashboardSheet from "@/components/wellness/WellnessDashboardSheet";
import WellnessGoLanding from "@/components/wellness/WellnessGoLanding";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getTodayProgress,
  loadWellnessState,
  MOODS,
  moodVoicePrompt,
  patchToday,
  WELLNESS_DISCLAIMER,
  WELLNESS_UPDATED_EVENT,
  type MoodId,
  type WellnessState,
} from "@/lib/wellness";
import { computeHabitStreak } from "@/lib/wellness-habits-meta";
import {
  coachSummary,
  computeWellnessScore,
  firstNameFromDisplay,
  smartRecommendations,
  timeGreeting,
} from "@/lib/wellness-home";
import { unlockYajAudio } from "@/lib/yaj-media";

const PILLARS = [
  {
    id: "sleep",
    label: "Sleep",
    blurb: "Sounds, breath, wind-down",
    path: "/wellness/sleep",
    tone: "from-indigo-900/80 to-slate-900",
    Icon: Moon,
  },
  {
    id: "move",
    label: "Move",
    blurb: "Gentle stretches & walks",
    path: "/wellness/move",
    tone: "from-emerald-800/80 to-teal-950",
    Icon: Footprints,
  },
  {
    id: "relax",
    label: "Relax",
    blurb: "Breathing & quick resets",
    path: "/wellness/relax",
    tone: "from-cyan-900/70 to-slate-900",
    Icon: Leaf,
  },
  {
    id: "habits",
    label: "Habits",
    blurb: "Small daily goals",
    path: "/wellness/habits",
    tone: "from-teal-800/70 to-stone-900",
    Icon: Sprout,
  },
] as const;

/** Explore → Wellness home — Go gate, dashboard, pillars. */
export default function WellnessHomePage() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [state, setState] = useState<WellnessState>(() => loadWellnessState());
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const today = getTodayProgress(state);

  useEffect(() => {
    const refresh = () => setState(loadWellnessState());
    refresh();
    window.addEventListener(WELLNESS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(WELLNESS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [location.pathname, location.key]);

  useEffect(() => {
    if (!user?.id) {
      setDisplayName("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setDisplayName(
          firstNameFromDisplay(
            (data as { display_name?: string } | null)?.display_name,
            user.email,
          ),
        );
      } catch {
        if (!cancelled) setDisplayName(firstNameFromDisplay(null, user.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const greeting = useMemo(() => timeGreeting(), []);
  const streak = useMemo(() => computeHabitStreak(state), [state]);
  const score = useMemo(() => computeWellnessScore(state, today), [state, today]);
  const recs = useMemo(
    () => smartRecommendations(state, today, today.mood),
    [state, today],
  );
  const coachLine = useMemo(
    () => coachSummary(state, today, score),
    [state, today, score],
  );

  const waterGoal = state.profile?.waterGoalCups ?? 8;
  const statusChips = [
    { id: "streak", label: `${streak} Day Streak`, Icon: Sparkles, on: streak > 0 },
    {
      id: "water",
      label: `Water ${today.waterCups || 0}/${waterGoal}`,
      Icon: Droplets,
      on: (today.waterCups || 0) > 0,
    },
    {
      id: "sleep",
      label: today.sleepRoutine ? "Sleep Goal Complete" : "Sleep pending",
      Icon: Moon,
      on: today.sleepRoutine,
    },
    {
      id: "move",
      label: `Movement ${today.moveMinutes || 0} min`,
      Icon: Footprints,
      on: (today.moveMinutes || 0) > 0,
    },
  ];

  const rings = [
    {
      id: "move",
      label: "Movement",
      value: `${today.moveMinutes || 0} / 20 min`,
      pct: Math.min(100, ((today.moveMinutes || 0) / 20) * 100),
      color: "#0d9488",
      Icon: Footprints,
    },
    {
      id: "water",
      label: "Water",
      value: `${today.waterCups || 0} / ${waterGoal}`,
      pct: Math.min(100, ((today.waterCups || 0) / waterGoal) * 100),
      color: "#0284c7",
      Icon: Droplets,
    },
    {
      id: "sleep",
      label: "Sleep",
      value: today.sleepRoutine ? "Complete" : "Not yet",
      pct: today.sleepRoutine ? 100 : today.sleepScore ? today.sleepScore * 20 : 0,
      color: "#6366f1",
      Icon: Moon,
    },
    {
      id: "mind",
      label: "Mindfulness",
      value: `${today.mindfulMinutes || 0} / 30 min`,
      pct: Math.min(100, ((today.mindfulMinutes || 0) / 30) * 100),
      color: "#14b8a6",
      Icon: Sparkles,
    },
  ];

  const onMood = (mood: MoodId) => {
    const next = patchToday((day) => {
      day.mood = mood;
    });
    setState({ ...next });
    unlockYajAudio();
    nav("/ask-yaj", {
      state: {
        openVoice: true,
        prompt: moodVoicePrompt(mood),
      },
    });
  };

  if (!state.onboarded) {
    return (
      <WellnessGoLanding
        onBack={() => nav("/explore")}
        onEnter={(next) => setState({ ...next })}
      />
    );
  }

  const name = displayName || "there";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f3f7f5] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_20%_0%,rgba(45,160,140,0.24),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(56,189,248,0.12),transparent_40%)]"
      />

      <header className="sticky top-0 z-20 border-b border-teal-900/5 bg-[#f3f7f5]/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-sm"
            aria-label="Back to Explore"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              {greeting.eyebrow}
            </p>
            <h1 className="truncate font-display text-xl font-bold tracking-tight">
              {greeting.hello}
              {displayName ? `, ${displayName}` : ""}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setDashboardOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-teal-800 shadow-sm"
            aria-label="Open wellness dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          How would you like to take care of yourself today?
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {statusChips.map((c) => (
            <span
              key={c.id}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                c.on
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-white/90 text-stone-600 ring-1 ring-stone-200"
              }`}
            >
              <c.Icon className="h-3.5 w-3.5" />
              {c.label}
            </span>
          ))}
        </div>
      </header>

      <div className="relative space-y-6 px-4 pt-5">
        {/* Mood check-in */}
        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,80,70,0.35)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
            Daily check-in
          </p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
            How are you feeling today?
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Tap a mood — YAJ opens in voice mode to check in with you.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {MOODS.map((m) => {
              const active = today.mood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMood(m.id)}
                  className={`rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                    active
                      ? "border-teal-600 bg-teal-50 shadow-sm"
                      : "border-stone-200/80 bg-stone-50/80 hover:bg-white"
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {m.emoji}
                  </span>
                  <p className="mt-1 text-[11px] font-bold leading-tight">{m.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Food Scan — featured between check-in and wellness score */}
        <button
          type="button"
          onClick={() => nav("/wellness/food")}
          className="relative w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-800 via-orange-950 to-stone-900 p-5 text-left text-amber-50 shadow-[0_18px_40px_-24px_rgba(120,60,20,0.55)] active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-amber-300/15 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-orange-200/10 blur-xl" />
          <Camera className="absolute right-4 top-4 h-5 w-5 text-amber-100/45" strokeWidth={1.75} />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/80">
            Nourish
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
            Food Scan
          </h2>
          <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-amber-50/75">
            Snap a snack or plate — YAJ gives a gentle nourish score and coach guidance.
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-amber-200 px-4 py-2 text-xs font-black text-amber-950">
            Open scanner →
          </span>
        </button>

        {/* Daily Wellness Score */}
        <section className="rounded-[1.75rem] border border-teal-200/60 bg-gradient-to-br from-white via-[#f3faf7] to-[#e8f5f0] p-5 shadow-[0_18px_40px_-28px_rgba(15,80,70,0.4)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
            Today’s Wellness
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-display text-4xl font-bold tracking-tight text-stone-900">
              {score.total}
              <span className="text-lg font-semibold text-stone-400"> / 100</span>
            </p>
            <p className="pb-1 text-sm font-bold text-teal-800">{score.label}</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${score.total}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {score.parts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 ring-1 ring-teal-900/5"
              >
                <span className="text-xs font-semibold text-stone-600">
                  {p.emoji} {p.label}
                </span>
                <span className="text-xs font-black text-teal-800">
                  +{p.points}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">{score.nudge}</p>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="font-display text-base font-bold tracking-tight">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {PILLARS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => nav(p.path)}
                className={`relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br ${p.tone} p-4 text-left text-white shadow-md active:scale-[0.98]`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_42%)]" />
                <p.Icon
                  className="absolute right-3 top-3 h-5 w-5 text-white/45"
                  strokeWidth={1.75}
                />
                <p className="relative text-lg font-black">{p.label}</p>
                <p className="relative mt-1 pr-6 text-[11px] text-white/80">{p.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Smart recommendations */}
        <section>
          <h2 className="font-display text-base font-bold tracking-tight">
            Recommended for You
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">YAJ picks these from today’s check-in</p>
          <div className="mt-3 space-y-2">
            {recs.map((r) => (
              <button
                key={r.title + r.path}
                type="button"
                onClick={() => nav(r.path)}
                className="flex w-full items-start gap-3 rounded-2xl border border-stone-200/80 bg-white/90 p-3.5 text-left shadow-sm"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-stone-500">{r.because}</p>
                  <p className="mt-0.5 text-sm font-black text-stone-900">→ {r.title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{r.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Circular progress */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold tracking-tight">Today’s progress</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Gentle tracking — missed days aren’t failures.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDashboardOpen(true)}
              className="text-[11px] font-bold text-teal-700"
            >
              Dashboard
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {rings.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center rounded-[1.5rem] border border-stone-200/70 bg-white/90 px-3 py-4 shadow-sm"
              >
                <ProgressRing pct={r.pct} color={r.color} Icon={r.Icon} />
                <p className="mt-2 text-[11px] font-semibold text-stone-500">{r.label}</p>
                <p className="text-sm font-black text-stone-900">{r.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* YAJ Coach */}
        <section className="rounded-[1.75rem] bg-gradient-to-br from-teal-800 via-emerald-900 to-stone-900 p-5 text-emerald-50 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200/80">
            YAJ Coach
          </p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-emerald-50/95">
            “{coachLine}”
          </p>
          <p className="mt-2 text-xs text-teal-100/60">Hey {name} — I’m here whenever you need me.</p>
          <button
            type="button"
            onClick={() => {
              unlockYajAudio();
              nav("/ask-yaj", {
                state: {
                  openVoice: true,
                  prompt:
                    "Give me a short, warm wellness check-in based on how my day is going. Keep it under a minute.",
                },
              });
            }}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-teal-300 text-sm font-black text-teal-950"
          >
            Ask YAJ
          </button>
        </section>

        <p className="pb-2 text-center text-[10px] leading-relaxed text-stone-400/80">
          {WELLNESS_DISCLAIMER}
        </p>
      </div>

      <WellnessDashboardSheet
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        onStateChange={(next) => setState({ ...next })}
      />
    </div>
  );
}

function ProgressRing({
  pct,
  color,
  Icon,
}: {
  pct: number;
  color: string;
  Icon: typeof Footprints;
}) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative h-[4.5rem] w-[4.5rem]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e7e5e4" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-stone-700">
        <Icon className="h-5 w-5" style={{ color }} />
      </span>
    </div>
  );
}
