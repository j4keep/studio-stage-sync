import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play, Timer } from "lucide-react";
import { toast } from "sonner";
import AmbientSoundPlayer from "@/components/wellness/AmbientSoundPlayer";
import BreathingSession from "@/components/wellness/BreathingSession";
import {
  AMBIENT_CATEGORIES,
  getAmbientTrack,
  tracksForCategory,
  type AmbientCategory,
  type AmbientTrack,
} from "@/lib/wellness-ambient-catalog";
import { wellnessAmbient } from "@/lib/wellness-ambient-engine";
import {
  BREATHING_SESSIONS,
  patchToday,
  loadWellnessState,
  saveWellnessState,
} from "@/lib/wellness";

export default function WellnessSleepPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [category, setCategory] = useState<AmbientCategory | "all">("sleep");
  const [playerTrack, setPlayerTrack] = useState<AmbientTrack | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [breathId, setBreathId] = useState<string | null>(null);
  const [sleepCheck, setSleepCheck] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const breath = useMemo(
    () => BREATHING_SESSIONS.find((b) => b.id === breathId) || null,
    [breathId],
  );

  const tracks = useMemo(() => tracksForCategory(category), [category]);

  useEffect(() => {
    const sound = params.get("sound");
    const breathParam = params.get("breath");
    const cat = params.get("category") as AmbientCategory | "all" | null;
    if (breathParam) setBreathId(breathParam);
    if (cat === "all" || AMBIENT_CATEGORIES.some((c) => c.id === cat)) {
      setCategory(cat);
    }
    if (sound) {
      const track = getAmbientTrack(sound);
      if (track) {
        setCategory(track.category);
        setPlayerTrack(track);
      }
    }
    return () => {
      void wellnessAmbient.stop();
    };
  }, [params]);

  const openTrack = (track: AmbientTrack) => {
    setPlayerTrack(track);
    const state = loadWellnessState();
    state.lastSound = track.id;
    saveWellnessState(state);
    patchToday((d) => {
      d.sleepRoutine = true;
    });
  };

  const saveMorningCheck = (score: 1 | 2 | 3 | 4 | 5) => {
    setSleepCheck(score);
    patchToday((d) => {
      d.sleepScore = score;
    });
    toast.success("Thanks — noted for today");
  };

  return (
    <div className="relative min-h-screen bg-[#0b1418] pb-28 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(56,120,180,0.28),_transparent_65%)]"
      />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b1418]/90 px-4 pb-3 pt-3 backdrop-blur">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">
              Main feature
            </p>
            <h1 className="text-lg font-black">Sleep</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-6 px-4 pt-5">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
          <Chip
            active={category === "all"}
            label="All"
            onClick={() => setCategory("all")}
          />
          {AMBIENT_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={category === c.id}
              label={`${c.emoji} ${c.label}`}
              onClick={() => setCategory(c.id)}
            />
          ))}
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-black">
                {category === "all"
                  ? "Sound library"
                  : AMBIENT_CATEGORIES.find((c) => c.id === category)?.label || "Sounds"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {tracks.length} sounds · Loop · Fade timer · Mix
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {tracks.map((t) => {
              const on = playingId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTrack(t)}
                  className={`group relative overflow-hidden rounded-2xl border p-0 text-left transition ${
                    on
                      ? "border-sky-400/60 shadow-[0_0_24px_-8px_rgba(56,189,248,0.55)]"
                      : "border-white/10"
                  }`}
                >
                  <div className={`h-24 bg-gradient-to-br ${t.art}`} />
                  <div className="space-y-1 bg-white/5 p-3">
                    <p className="text-sm font-black leading-snug">{t.title}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
                      {t.durationLabel}
                    </p>
                    <p className="text-[11px] text-slate-400">{on ? "Playing now" : t.blurb}</p>
                  </div>
                  <span className="absolute bottom-[4.6rem] right-2 flex h-9 w-9 items-center justify-center rounded-full bg-sky-400 text-slate-950 opacity-95 shadow-lg">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </span>
                </button>
              );
            })}
          </div>
          {tracks.length === 0 ? (
            <p className="mt-4 text-center text-xs text-slate-500">No sounds in this category yet.</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-black">How it works</h2>
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
            <li>· Open any card → full player with artwork</li>
            <li>· Mix layers (rain + thunder + fireplace…)</li>
            <li>· Fade-out timer: 15 / 30 / 45 / 60 min</li>
            <li>· Sparkle button: YAJ whispers a short wind-down</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-black">Bedtime breathing</h2>
          <div className="mt-3 space-y-2">
            {BREATHING_SESSIONS.filter((b) => b.id !== "reset-2").map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBreathId(b.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-bold">{b.title}</p>
                  <p className="text-[11px] text-slate-400">{b.blurb}</p>
                </div>
                <span className="text-xs font-bold text-sky-300">{b.minutes} min</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-black">How did you sleep?</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Morning check-in — optional, private on this device.
          </p>
          <div className="mt-3 flex gap-2">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => saveMorningCheck(n)}
                className={`h-10 flex-1 rounded-xl text-sm font-black ${
                  sleepCheck === n ? "bg-sky-400 text-slate-950" : "bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">1 = rough · 5 = rested</p>
        </section>

      </div>

      {playerTrack ? (
        <AmbientSoundPlayer
          track={playerTrack}
          onClose={() => {
            setPlayerTrack(null);
            setPlayingId(null);
          }}
          onPlayingChange={(playing) => setPlayingId(playing ? playerTrack.id : null)}
        />
      ) : null}

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
              d.sleepRoutine = true;
              d.mindfulMinutes += mins;
            });
          }}
          onComplete={() => {
            patchToday((d) => {
              d.sleepRoutine = true;
            });
          }}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${
        active ? "bg-sky-400 text-slate-950" : "bg-white/10 text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
