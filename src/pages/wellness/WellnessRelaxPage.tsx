import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play, Square } from "lucide-react";
import { toast } from "sonner";
import AmbientSoundPlayer from "@/components/wellness/AmbientSoundPlayer";
import BreathExperienceCard, {
  BreathExperienceCardStyles,
} from "@/components/wellness/BreathExperienceCard";
import BreathingSession from "@/components/wellness/BreathingSession";
import RelaxNarratedSession from "@/components/wellness/RelaxNarratedSession";
import RelaxNowPlayingBar from "@/components/wellness/RelaxNowPlayingBar";
import { getAmbientTrack, type AmbientTrack } from "@/lib/wellness-ambient-catalog";
import { wellnessAmbient } from "@/lib/wellness-ambient-engine";
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
  REFLECTION_PROMPTS,
  RELAX_SOUND_CARDS,
  RELAX_TECHNIQUES,
  relaxRecommendationForMood,
  saveTonightReflection,
  toggleSoundFavorite,
  type NarratedSession,
  type NightReflection,
} from "@/lib/wellness-relax";

const DEFAULT_DOCK_MINUTES = 30;

export default function WellnessRelaxPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [breathId, setBreathId] = useState<string | null>(null);
  const [dockTrack, setDockTrack] = useState<AmbientTrack | null>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [dockPlaying, setDockPlaying] = useState(false);
  const [dockEndsAt, setDockEndsAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [session, setSession] = useState<NarratedSession | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState<string | null>(null);
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
      if (t) void startDockedSound(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!dockEndsAt || !dockPlaying) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((dockEndsAt - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        setDockPlaying(false);
        setDockEndsAt(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [dockEndsAt, dockPlaying]);

  const logMoment = () => {
    setWeekMoments(bumpRelaxMoment());
    patchToday((d) => {
      d.mindfulMinutes += 1;
    });
  };

  const startDockedSound = async (t: AmbientTrack) => {
    try {
      await wellnessAmbient.playTrack(t.id, { volume: 0.45, loop: true });
      setDockTrack(t);
      setDockPlaying(true);
      setPlayerExpanded(false);
      const ends = Date.now() + DEFAULT_DOCK_MINUTES * 60_000;
      setDockEndsAt(ends);
      setRemainingSec(DEFAULT_DOCK_MINUTES * 60);
      wellnessAmbient.setTimerMinutes(DEFAULT_DOCK_MINUTES, () => {
        setDockPlaying(false);
        setDockEndsAt(null);
        setRemainingSec(0);
      });
      logMoment();
    } catch {
      toast.error("Sound unavailable");
    }
  };

  const openSound = (id: string) => {
    // Tap the playing sound again → stop it completely.
    if (dockTrack?.id === id && dockPlaying) {
      dismissDock();
      return;
    }
    // Tap the paused docked sound → resume.
    if (dockTrack?.id === id && !dockPlaying) {
      toggleDock();
      return;
    }
    const t = getAmbientTrack(id);
    if (!t) {
      toast.error("Sound unavailable");
      return;
    }
    void startDockedSound(t);
  };

  const dismissDock = () => {
    void wellnessAmbient.fadeOutStop(500);
    setDockTrack(null);
    setDockPlaying(false);
    setDockEndsAt(null);
    setRemainingSec(null);
    setPlayerExpanded(false);
  };

  const toggleDock = () => {
    if (!dockTrack) return;
    if (dockPlaying) {
      wellnessAmbient.softPause();
      setDockPlaying(false);
      return;
    }
    if (wellnessAmbient.isSoftPaused() && wellnessAmbient.getPrimaryId() === dockTrack.id) {
      wellnessAmbient.softResume();
      setDockPlaying(true);
      return;
    }
    void startDockedSound(dockTrack);
  };

  const runRecAction = (action: (typeof recommendation.actions)[number]) => {
    if (action.kind === "breath") {
      dismissDock();
      setBreathId(action.id);
    } else if (action.kind === "sound") openSound(action.id);
    else if (action.id === "reflection") setReflectionOpen("went-well");
    else {
      const s = getNarratedSession(action.id);
      if (s) setSession(s);
    }
  };

  const saveReflection = () => {
    saveTonightReflection(reflection);
    logMoment();
    toast.success("Reflection saved");
    setReflectionOpen(null);
  };

  const soundEmoji = (id: string) => RELAX_SOUND_CARDS.find((s) => s.id === id)?.emoji || "🎧";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b1614] pb-36 text-emerald-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_20%_0%,rgba(45,212,191,0.2),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(56,189,248,0.1),transparent_40%)]" />
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
              Soft space
            </p>
            <h1 className="font-display text-lg font-bold tracking-tight">Relax</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-10 px-4 pt-5">
        {/* Hero */}
        <button
          type="button"
          onClick={() => {
            dismissDock();
            setBreathId("reset-2");
          }}
          className="relative w-full overflow-hidden rounded-[2rem] p-7 text-left shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-800 via-emerald-900 to-cyan-950" />
          <div className="relax-hero-float pointer-events-none absolute -left-6 top-4 h-28 w-28 rounded-full bg-teal-300/15 blur-xl" />
          <div className="relax-hero-float-2 pointer-events-none absolute right-0 top-10 h-36 w-36 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="relax-hero-float pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-emerald-200/10 blur-xl" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100/70">
              🌿 Take a Moment
            </p>
            <h2 className="mt-3 font-display text-[2rem] font-bold leading-[1.1] tracking-tight text-white">
              Take a Breath.
            </h2>
            <p className="mt-3 max-w-[16rem] text-[15px] leading-relaxed text-teal-50/80">
              You don’t have to solve everything right now.
            </p>
            <span className="mt-6 inline-flex items-center rounded-full bg-teal-300 px-5 py-2.5 text-sm font-black tracking-wide text-teal-950">
              START RESET
            </span>
          </div>
        </button>

        {/* Guided Breathing */}
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">Guided Breathing</h2>
          <p className="mt-1 text-xs text-teal-100/50">Each one feels different — pick what you need</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BREATHING_SESSIONS.map((b) => (
              <BreathExperienceCard
                key={b.id}
                session={b}
                onStart={() => {
                  dismissDock();
                  setBreathId(b.id);
                }}
              />
            ))}
          </div>
        </section>

        {/* Sound Library */}
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">Relax Sounds</h2>
          <p className="mt-1 text-xs text-teal-100/50">Starts instantly — mini player stays with you</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {RELAX_SOUND_CARDS.map((s) => {
              const fav = favs.includes(s.id);
              const selected = dockTrack?.id === s.id;
              const playing = selected && dockPlaying;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSound(s.id)}
                  aria-label={playing ? `Stop ${s.title}` : `Play ${s.title}`}
                  className={`relative flex flex-col items-center rounded-2xl border px-2 py-3.5 text-center transition ${
                    selected
                      ? "border-teal-300/50 bg-teal-400/15"
                      : "border-white/10 bg-white/5 active:bg-white/10"
                  }`}
                >
                  {fav ? (
                    <span className="absolute right-1.5 top-1.5 text-[10px] text-rose-300">♥</span>
                  ) : null}
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="mt-1.5 text-[11px] font-bold leading-tight">{s.title}</span>
                  <span
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${
                      playing ? "bg-white text-teal-950" : "bg-teal-400/90 text-teal-950"
                    }`}
                  >
                    {playing ? (
                      <Square className="h-2.5 w-2.5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-3 w-3 fill-current" />
                    )}
                  </span>
                  {playing ? (
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-teal-200/80">
                      Tap to stop
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Mental Resets */}
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">Quick Mental Resets</h2>
          <p className="mt-1 text-xs text-teal-100/50">Narrated by YAJ — not a chat</p>
          <div className="mt-3 space-y-2">
            {MENTAL_RESETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSession(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.02] px-4 py-3.5 text-left"
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
          <h2 className="font-display text-lg font-bold tracking-tight">Relaxation Techniques</h2>
          <p className="mt-1 text-xs text-teal-100/50">Interactive skills with YAJ voice</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {RELAX_TECHNIQUES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSession(s)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left"
              >
                <p className="text-lg">{s.emoji}</p>
                <p className="mt-1.5 text-[13px] font-black leading-snug">{s.title}</p>
                <p className="mt-1 text-[10px] font-semibold text-teal-300/80">{s.minutes} min</p>
              </button>
            ))}
          </div>
        </section>

        {/* Reflections — elegant prompts */}
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Daily Reflection</h2>
            <p className="mt-1 text-xs text-teal-100/50">Private on this device</p>
          </div>
          {REFLECTION_PROMPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setReflectionOpen(p.id)}
              className={`relative w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${p.accent} px-6 py-8 text-left`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200/70">
                {p.emoji} {p.eyebrow}
              </p>
              <p className="mt-4 max-w-[17rem] font-serif text-[1.55rem] leading-snug tracking-tight text-white">
                {p.prompt}
              </p>
              <p className="mt-6 text-sm font-bold text-teal-200/90">{p.cta}</p>
            </button>
          ))}
        </section>

        {/* Quote */}
        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300/70">
            Quote of the Day
          </p>
          <p className="mt-5 font-serif text-[1.45rem] leading-relaxed tracking-tight text-emerald-50/95">
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

      <BreathExperienceCardStyles />
      <style>{`
        .relax-hero-float { animation: relaxFloat 8s ease-in-out infinite; }
        .relax-hero-float-2 { animation: relaxFloat 11s ease-in-out infinite reverse; }
        @keyframes relaxFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-12px) scale(1.06); }
        }
      `}</style>

      {dockTrack && !playerExpanded && !breath && !session && !reflectionOpen ? (
        <RelaxNowPlayingBar
          track={dockTrack}
          emoji={soundEmoji(dockTrack.id)}
          playing={dockPlaying}
          remainingSec={remainingSec}
          onToggle={toggleDock}
          onExpand={() => setPlayerExpanded(true)}
          onDismiss={dismissDock}
        />
      ) : null}

      {breath && (
        <BreathingSession
          open
          sessionId={breath.id}
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

      {dockTrack && playerExpanded ? (
        <AmbientSoundPlayer
          track={dockTrack}
          continuePlayback
          persistAudioOnUnmount
          playerLabel="YAJ Sound Player"
          favorite={favs.includes(dockTrack.id)}
          onToggleFavorite={() => setFavs(toggleSoundFavorite(dockTrack.id))}
          onMinimize={() => setPlayerExpanded(false)}
          onClose={dismissDock}
          onPlayingChange={setDockPlaying}
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

      {reflectionOpen ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b1614] text-emerald-50">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(45,212,191,0.18),transparent_50%)]" />
          <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setReflectionOpen(null)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"
            >
              Close
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200/70">
              Journal
            </p>
            <span className="w-14" />
          </header>
          <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-10 pt-8">
            <p className="font-serif text-[1.75rem] leading-snug tracking-tight text-white">
              {reflectionOpen === "let-go"
                ? "What’s one thing you don’t need to carry into tomorrow?"
                : "What went well today?"}
            </p>
            <p className="mt-3 text-sm text-teal-100/55">Write freely. Nothing leaves this device.</p>

            {reflectionOpen === "let-go" ? (
              <label className="mt-10 block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200/60">
                  Release
                </span>
                <textarea
                  value={reflection.improve}
                  onChange={(e) => setReflection((r) => ({ ...r, improve: e.target.value }))}
                  rows={5}
                  placeholder="I can set this down…"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-serif text-lg leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-teal-400/40"
                />
              </label>
            ) : (
              <div className="mt-10 space-y-6">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200/60">
                    Grateful for
                  </span>
                  <textarea
                    value={reflection.grateful}
                    onChange={(e) => setReflection((r) => ({ ...r, grateful: e.target.value }))}
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-serif text-lg leading-relaxed text-white outline-none focus:border-teal-400/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200/60">
                    Proud of
                  </span>
                  <textarea
                    value={reflection.proud}
                    onChange={(e) => setReflection((r) => ({ ...r, proud: e.target.value }))}
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-serif text-lg leading-relaxed text-white outline-none focus:border-teal-400/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200/60">
                    Improve tomorrow
                  </span>
                  <textarea
                    value={reflection.improve}
                    onChange={(e) => setReflection((r) => ({ ...r, improve: e.target.value }))}
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-serif text-lg leading-relaxed text-white outline-none focus:border-teal-400/40"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={saveReflection}
              className="mt-10 h-12 w-full rounded-full bg-teal-300 text-sm font-black text-teal-950"
            >
              Save Entry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
