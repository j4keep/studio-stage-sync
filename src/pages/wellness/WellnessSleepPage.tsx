import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Timer } from "lucide-react";
import { toast } from "sonner";
import BreathingSession from "@/components/wellness/BreathingSession";
import { sleepAmbience } from "@/lib/sleep-ambience";
import {
  BREATHING_SESSIONS,
  patchToday,
  SLEEP_SOUNDS,
  type SleepSoundId,
  loadWellnessState,
  saveWellnessState,
} from "@/lib/wellness";

const TIMER_OPTS = [15, 30, 45, 60];

export default function WellnessSleepPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [active, setActive] = useState<SleepSoundId | null>(null);
  const [volume, setVolume] = useState(0.35);
  const [timerMin, setTimerMin] = useState(30);
  const [timerArmed, setTimerArmed] = useState(false);
  const [breathId, setBreathId] = useState<string | null>(null);
  const [sleepCheck, setSleepCheck] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const breath = useMemo(
    () => BREATHING_SESSIONS.find((b) => b.id === breathId) || null,
    [breathId],
  );

  useEffect(() => {
    const sound = params.get("sound") as SleepSoundId | null;
    const breathParam = params.get("breath");
    if (breathParam) setBreathId(breathParam);
    if (sound && SLEEP_SOUNDS.some((s) => s.id === sound)) {
      void startSound(sound);
    }
    return () => {
      void sleepAmbience.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSound = async (id: SleepSoundId) => {
    try {
      await sleepAmbience.play(id, volume);
      setActive(id);
      const state = loadWellnessState();
      state.lastSound = id;
      saveWellnessState(state);
      if (timerArmed) {
        sleepAmbience.setTimerMinutes(timerMin, () => {
          setActive(null);
          setTimerArmed(false);
          toast.message("Sleep timer finished — sweet dreams");
          patchToday((d) => {
            d.sleepRoutine = true;
          });
        });
      }
    } catch {
      toast.error("Couldn’t start sound — tap again after interacting with the page");
    }
  };

  const toggleSound = async (id: SleepSoundId) => {
    if (active === id) {
      await sleepAmbience.fadeOutStop();
      setActive(null);
      return;
    }
    await startSound(id);
  };

  const armTimer = () => {
    setTimerArmed(true);
    if (active) {
      sleepAmbience.setTimerMinutes(timerMin, () => {
        setActive(null);
        setTimerArmed(false);
        toast.message("Sleep timer finished — sweet dreams");
        patchToday((d) => {
          d.sleepRoutine = true;
        });
      });
    }
    toast.success(`Timer set for ${timerMin} min`);
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">Main feature</p>
            <h1 className="text-lg font-black">Sleep</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-6 px-4 pt-5">
        <section>
          <h2 className="text-base font-black">Sleep sounds</h2>
          <p className="mt-1 text-xs text-slate-400">Rain, ocean, fan, white noise, nature — tap to play.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {SLEEP_SOUNDS.map((s) => {
              const on = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void toggleSound(s.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    on
                      ? "border-sky-400/60 bg-sky-500/20 shadow-[0_0_24px_-8px_rgba(56,189,248,0.55)]"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="text-sm font-black">{s.label}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{on ? "Playing · tap to stop" : s.blurb}</p>
                </button>
              );
            })}
          </div>
          <label className="mt-4 flex items-center gap-3 text-xs text-slate-400">
            Volume
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                sleepAmbience.setVolume(v);
              }}
              className="flex-1"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-black">Sleep timer</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIMER_OPTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTimerMin(m)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  timerMin === m ? "bg-sky-400 text-slate-950" : "bg-white/10"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={armTimer}
            className="mt-3 h-11 w-full rounded-full bg-sky-400 text-sm font-black text-slate-950"
          >
            {timerArmed ? `Timer on · ${timerMin} min` : "Start timer with sound"}
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Sound fades out when the timer ends. Start a sound first or after arming.
          </p>
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
          <p className="mt-1 text-[11px] text-slate-400">Morning check-in — optional, private on this device.</p>
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

        <p className="text-[11px] text-slate-500">
          What’s keeping you awake? Try rain + wind-down breath, or arm a sleep timer and put the phone aside.
        </p>
      </div>

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
          onComplete={() => {
            patchToday((d) => {
              d.sleepRoutine = true;
              d.mindfulMinutes += breath.minutes;
            });
          }}
        />
      )}
    </div>
  );
}
