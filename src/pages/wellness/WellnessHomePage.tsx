import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Footprints, LayoutDashboard, Moon, Sparkles } from "lucide-react";
import WellnessDashboardSheet from "@/components/wellness/WellnessDashboardSheet";
import WellnessGoLanding from "@/components/wellness/WellnessGoLanding";
import {
  getTodayProgress,
  loadWellnessState,
  MOODS,
  moodVoicePrompt,
  patchToday,
  recommendForMood,
  timeOfDayRecs,
  WELLNESS_DISCLAIMER,
  WELLNESS_UPDATED_EVENT,
  type MoodId,
  type WellnessRec,
  type WellnessState,
} from "@/lib/wellness";
import { unlockYajAudio } from "@/lib/yaj-media";

const PILLARS = [
  {
    id: "sleep",
    label: "Sleep",
    blurb: "Sounds, breath, wind-down",
    path: "/wellness/sleep",
    tone: "from-indigo-900/80 to-slate-900",
  },
  {
    id: "move",
    label: "Move",
    blurb: "Gentle stretches & walks",
    path: "/wellness/move",
    tone: "from-emerald-800/80 to-teal-950",
  },
  {
    id: "relax",
    label: "Relax",
    blurb: "Breathing & quick resets",
    path: "/wellness/relax",
    tone: "from-cyan-900/70 to-slate-900",
  },
  {
    id: "habits",
    label: "Habits",
    blurb: "Small daily goals",
    path: "/wellness/habits",
    tone: "from-teal-800/70 to-stone-900",
  },
] as const;

/** Explore → Wellness home — Go gate, dashboard, pillars. */
export default function WellnessHomePage() {
  const nav = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<WellnessState>(() => loadWellnessState());
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const today = getTodayProgress(state);
  const [buddyNote, setBuddyNote] = useState<string | null>(null);
  const [recs, setRecs] = useState<WellnessRec[]>(() =>
    today.mood ? recommendForMood(today.mood) : timeOfDayRecs(),
  );

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

  const progressBits = useMemo(
    () => [
      {
        label: "Movement",
        value: today.moveMinutes > 0 ? `${today.moveMinutes} min` : "—",
        done: today.moveMinutes > 0,
        icon: Footprints,
      },
      {
        label: "Water",
        value:
          today.waterCups > 0
            ? `${today.waterCups}/${state.profile?.waterGoalCups ?? 8}`
            : today.water
              ? "Logged"
              : "—",
        done: today.water || today.waterCups > 0,
        icon: Droplets,
      },
      {
        label: "Sleep routine",
        value: today.sleepRoutine ? "Done" : "—",
        done: today.sleepRoutine,
        icon: Moon,
      },
      {
        label: "Mindful",
        value: today.mindfulMinutes > 0 ? `${today.mindfulMinutes} min` : "—",
        done: today.mindfulMinutes > 0,
        icon: Sparkles,
      },
    ],
    [
      today.moveMinutes,
      today.water,
      today.waterCups,
      today.sleepRoutine,
      today.mindfulMinutes,
      state.profile?.waterGoalCups,
    ],
  );

  const onMood = (mood: MoodId) => {
    const next = patchToday((day) => {
      day.mood = mood;
    });
    setState({ ...next });
    const tips = recommendForMood(mood);
    setRecs(tips);
    const label = MOODS.find((m) => m.id === mood)?.label.toLowerCase() ?? "okay";
    const first = tips[0];
    setBuddyNote(
      first
        ? `You selected ${label}. Opening YAJ voice to check in with you…`
        : `You selected ${label}. Opening YAJ voice to check in with you…`,
    );
    // Open Ask YAJ voice mode (not text) with a seeded feeling prompt.
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f3f7f5] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(45,160,140,0.22),_transparent_62%)]"
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
              Sleep · Move · Relax
            </p>
            <h1 className="text-xl font-black tracking-tight">Wellness</h1>
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
        <p className="mt-2 text-sm text-stone-600">
          Feel better, sleep better, move more — one small step at a time.
        </p>
      </header>

      <div className="relative space-y-6 px-4 pt-5">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,80,70,0.35)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Daily check-in</p>
          <h2 className="mt-1 text-lg font-black">How are you feeling today?</h2>
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
          {buddyNote && (
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-teal-800 to-emerald-900 p-3 text-teal-50">
              <p className="text-[10px] font-bold uppercase tracking-wide text-teal-200/90">YAJ</p>
              <p className="mt-1 text-sm leading-relaxed">{buddyNote}</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-base font-black">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {PILLARS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => nav(p.path)}
                className={`relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br ${p.tone} p-4 text-left text-white shadow-md active:scale-[0.98]`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_42%)]" />
                <p className="relative text-lg font-black">{p.label}</p>
                <p className="relative mt-1 text-[11px] text-white/80">{p.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-black">Recommended for you</h2>
          <div className="mt-3 space-y-2">
            {recs.map((r) => (
              <button
                key={r.title + r.path}
                type="button"
                onClick={() => nav(r.path)}
                className="flex w-full items-start gap-3 rounded-2xl border border-stone-200/80 bg-white/90 p-3.5 text-left shadow-sm"
              >
                <span className="mt-0.5 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                  {r.pillar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{r.title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{r.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-black">Today’s progress</h2>
              <p className="mt-0.5 text-xs text-stone-500">Gentle tracking — missed days aren’t failures.</p>
            </div>
            <button
              type="button"
              onClick={() => setDashboardOpen(true)}
              className="text-[11px] font-bold text-teal-700"
            >
              Dashboard
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {progressBits.map((b) => (
              <div
                key={b.label}
                className={`rounded-2xl border p-3 ${
                  b.done ? "border-teal-200 bg-teal-50/80" : "border-stone-200/80 bg-white/70"
                }`}
              >
                <b.icon className={`h-4 w-4 ${b.done ? "text-teal-700" : "text-stone-400"}`} />
                <p className="mt-2 text-[11px] font-semibold text-stone-500">{b.label}</p>
                <p className="text-sm font-black">{b.value}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="pb-2 text-[11px] leading-relaxed text-stone-500">{WELLNESS_DISCLAIMER}</p>
      </div>

      <WellnessDashboardSheet
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        onStateChange={(next) => setState({ ...next })}
      />
    </div>
  );
}
