import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import AmbientSoundPlayer from "@/components/wellness/AmbientSoundPlayer";
import BreathingSession from "@/components/wellness/BreathingSession";
import RelaxNarratedSession from "@/components/wellness/RelaxNarratedSession";
import { getAmbientTrack, type AmbientTrack } from "@/lib/wellness-ambient-catalog";
import {
  BREATHING_SESSIONS,
  getTodayProgress,
  patchToday,
  type MoodId,
} from "@/lib/wellness";
import {
  bumpRelaxMoment,
  getNarratedSession,
  loadSoundFavorites,
  loadTonightReflection,
  MENTAL_RESETS,
  momentsThisWeek,
  quoteOfTheDay,
  RELAX_SOUND_CARDS,
  RELAX_TECHNIQUES,
  relaxRecommendationForMood,
  saveTonightReflection,
  toggleSoundFavorite,
  type NarratedSession,
  type NightReflection,
} from "@/lib/wellness-relax";

const BREATH_EMOJI: Record<string, string> = {
  box: "🫁",
  calm: "🌊",
  "wind-down": "🌙",
  "reset-2": "⚡",
};

export default function WellnessRelaxPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [breathId, setBreathId] = useState<string | null>(null);
  const [soundTrack, setSoundTrack] = useState<AmbientTrack | null>(null);
  const [session, setSession] = useState<NarratedSession | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => loadSoundFavorites());
  const [weekMoments, setWeekMoments] = useState(() => momentsThisWeek());
  const [reflection, setReflection] = useState<NightReflection>(() => loadTonightReflection());
  const mood = getTodayProgress().mood as MoodId | undefined;
  const recommendation = useMemo(() => relaxRecommendationForMood(mood), [mood]);
  const quote = useMemo(() => quoteOfTheDay(), []);

  const breath = useMemo(
    () => BREATHING_SESSIONS.find((b) => b.id === breathId) || null,
    [breathId],
  );

  useEffect(() => {
    const start = params.get("start");
    if (start && BREATHING_SESSIONS.some((b) => b.id === start)) setBreathId(start);
    const sound = params.get("sound");
    if (sound) {
      const t = getAmbientTrack(sound);
      if (t) setSoundTrack(t);
    }
  }, [params]);

  const logMoment = () => {
    setWeekMoments(bumpRelaxMoment());
    patchToday((d) => {
      d.mindfulMinutes += 1;
    });
  };

  const openSound = (id: string) => {
    const t = getAmbientTrack(id);
    if (!t) {
      toast.error("Sound unavailable");
      return;
    }
    setSoundTrack(t);
    logMoment();
  };

  const runRecAction = (action: (typeof recommendation.actions)[number]) => {
    if (action.kind === "breath") setBreathId(action.id);
    else if (action.kind === "sound") openSound(action.id);
    else if (action.id === "reflection") setShowReflection(true);
    else {
      const s = getNarratedSession(action.id);
      if (s) setSession(s);
    }
  };

  const saveReflection = () => {
    saveTonightReflection(reflection);
    logMoment();
    toast.success("Reflection saved");
    setShowReflection(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b1614] pb-28 text-emerald-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_30%_0%,rgba(45,212,191,0.22),transparent_55%)]" />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b1614]/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/wellness")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/80">
              Calm tools
            </p>
            <h1 className="text-lg font-black">Relax</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-8 px-4 pt-5">
        {/* Hero */}
        <button
          type="button"
          onClick={() => setBreathId("reset-2")}
          className="relative w-full overflow-hidden rounded-[1.75rem] p-6 text-left shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-800 via-emerald-900 to-cyan-950" />
          <div className="relax-hero-float pointer-events-none absolute -left-6 top-4 h-24 w-24 rounded-full bg-teal-300/15 blur-xl" />
          <div className="relax-hero-float-2 pointer-events-none absolute right-0 top-10 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="relax-hero-float pointer-events-none absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-emerald-200/10 blur-xl" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100/80">
              🌿 Take a Moment
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Take two minutes for yourself.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-teal-50/80">
              Breathe. Reset. Refocus.
            </p>
            <span className="mt-5 inline-flex items-center rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-teal-950">
              Start Reset
            </span>
          </div>
        </button>

        {/* Guided Breathing */}
        <section>
          <h2 className="text-base font-black">Guided Breathing</h2>
          <p className="mt-1 text-xs text-teal-100/50">Voice guidance · timer · soft visuals</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {BREATHING_SESSIONS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBreathId(b.id)}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition active:bg-white/10"
              >
                <p className="text-xl">{BREATH_EMOJI[b.id] || "💨"}</p>
                <p className="mt-2 text-sm font-black leading-snug">{b.title}</p>
                <p className="mt-1 text-[11px] font-semibold text-teal-300/80">{b.minutes} min</p>
              </button>
            ))}
          </div>
        </section>

        {/* Sound Library */}
        <section>
          <h2 className="text-base font-black">Relax Sounds</h2>
          <p className="mt-1 text-xs text-teal-100/50">Tap any sound for the full player</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {RELAX_SOUND_CARDS.map((s) => {
              const fav = favs.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSound(s.id)}
                  className="relative flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-2 py-3.5 text-center active:bg-white/10"
                >
                  {fav ? (
                    <span className="absolute right-1.5 top-1.5 text-[10px] text-rose-300">♥</span>
                  ) : null}
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="mt-1.5 text-[11px] font-bold leading-tight">{s.title}</span>
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-teal-400/90 text-teal-950">
                    <Play className="ml-0.5 h-3 w-3 fill-current" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Mental Resets */}
        <section>
          <h2 className="text-base font-black">Quick Mental Resets</h2>
          <p className="mt-1 text-xs text-teal-100/50">Narrated by YAJ — not a chat</p>
          <div className="mt-3 space-y-2">
            {MENTAL_RESETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSession(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left"
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">{s.title}</span>
                  <span className="block text-[11px] text-teal-100/50">{s.blurb}</span>
                </span>
                <span className="text-xs font-bold text-teal-300">{s.minutes} min</span>
              </button>
            ))}
          </div>
        </section>

        {/* Techniques */}
        <section>
          <h2 className="text-base font-black">Relaxation Techniques</h2>
          <p className="mt-1 text-xs text-teal-100/50">Interactive skills with YAJ voice</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {RELAX_TECHNIQUES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSession(s)}
                className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left"
              >
                <p className="text-lg">{s.emoji}</p>
                <p className="mt-1.5 text-[13px] font-black leading-snug">{s.title}</p>
                <p className="mt-1 text-[10px] font-semibold text-teal-300/80">{s.minutes} min</p>
              </button>
            ))}
          </div>
        </section>

        {/* Reflection */}
        <section className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300/80">
            Tonight’s Reflection
          </p>
          <h2 className="mt-1 text-lg font-black">What went well today?</h2>
          <p className="mt-1 text-xs text-teal-100/55">Write three things. Private on this device.</p>
          {!showReflection ? (
            <button
              type="button"
              onClick={() => setShowReflection(true)}
              className="mt-4 h-11 w-full rounded-full bg-teal-400 text-sm font-black text-teal-950"
            >
              Open reflection
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <label className="block text-[11px] font-semibold text-teal-100/70">
                One thing you’re grateful for
                <textarea
                  value={reflection.grateful}
                  onChange={(e) => setReflection((r) => ({ ...r, grateful: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-teal-400/50"
                />
              </label>
              <label className="block text-[11px] font-semibold text-teal-100/70">
                One thing you’ll improve tomorrow
                <textarea
                  value={reflection.improve}
                  onChange={(e) => setReflection((r) => ({ ...r, improve: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-teal-400/50"
                />
              </label>
              <label className="block text-[11px] font-semibold text-teal-100/70">
                One thing you’re proud of
                <textarea
                  value={reflection.proud}
                  onChange={(e) => setReflection((r) => ({ ...r, proud: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-teal-400/50"
                />
              </label>
              <button
                type="button"
                onClick={saveReflection}
                className="h-11 w-full rounded-full bg-teal-400 text-sm font-black text-teal-950"
              >
                Save Entry
              </button>
            </div>
          )}
        </section>

        {/* Quote */}
        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300/70">
            Quote of the Day
          </p>
          <p className="mt-3 font-serif text-xl leading-relaxed tracking-tight text-emerald-50/95">
            “{quote}”
          </p>
        </section>

        {/* Streak */}
        <section className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(100, (weekMoments / 7) * 100)} 100`}
              />
            </svg>
            <span className="absolute text-lg">🔥</span>
          </div>
          <div>
            <p className="text-sm font-black">Relax Streak</p>
            <p className="mt-0.5 text-xs text-teal-100/60">
              You’ve taken <span className="font-bold text-teal-200">{weekMoments}</span> moment
              {weekMoments === 1 ? "" : "s"} this week.
            </p>
            <p className="mt-1 text-[11px] text-teal-100/45">Keep going.</p>
          </div>
        </section>

        {/* Personalized recommendation */}
        <section className="rounded-[1.5rem] border border-teal-400/25 bg-gradient-to-br from-teal-500/15 to-emerald-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300/90">
            {recommendation.title}
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-50/95">
            {recommendation.detail}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recommendation.actions.map((a) => (
              <button
                key={`${a.kind}-${a.id}`}
                type="button"
                onClick={() => runRecAction(a)}
                className="rounded-full bg-teal-400 px-3.5 py-2 text-xs font-black text-teal-950"
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .relax-hero-float { animation: relaxFloat 8s ease-in-out infinite; }
        .relax-hero-float-2 { animation: relaxFloat 11s ease-in-out infinite reverse; }
        @keyframes relaxFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-12px) scale(1.06); }
        }
      `}</style>

      {breath && (
        <BreathingSession
          open
          onClose={() => setBreathId(null)}
          title={breath.title}
          inhale={breath.inhale}
          hold={breath.hold}
          exhale={breath.exhale}
          holdOut={breath.holdOut}
          minutes={breath.minutes}
          onProgress={(mins) => {
            patchToday((d) => {
              d.mindfulMinutes += mins;
            });
            logMoment();
            toast.success(`${mins} mindful min logged`);
          }}
          onComplete={() => {
            logMoment();
            toast.success("Session complete");
          }}
        />
      )}

      {soundTrack ? (
        <AmbientSoundPlayer
          track={soundTrack}
          favorite={favs.includes(soundTrack.id)}
          onToggleFavorite={() => setFavs(toggleSoundFavorite(soundTrack.id))}
          onClose={() => setSoundTrack(null)}
        />
      ) : null}

      {session ? (
        <RelaxNarratedSession
          session={session}
          onClose={() => setSession(null)}
          onComplete={() => {
            logMoment();
          }}
        />
      ) : null}
    </div>
  );
}
