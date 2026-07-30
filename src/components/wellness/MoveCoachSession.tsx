import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat2,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import MoveFinishScreen from "@/components/wellness/MoveFinishScreen";
import MoveInstructionCard from "@/components/wellness/MoveInstructionCard";
import {
  bumpMoveStreak,
  COACH_VOICE_SPEEDS,
  estimateCalories,
  type CoachRoutine,
  type CoachVoiceSpeedId,
} from "@/lib/wellness-move-coach";
import {
  getTodayProgress,
  getWellnessFigure,
  getWellnessSkinTone,
  MOODS,
} from "@/lib/wellness";
import {
  pauseYajAudio,
  playYajAudioAsync,
  resumeYajAudio,
  stopYajAudio,
  synthesizeYajVoice,
  unlockYajAudio,
  YAJ_TTS_VOICES,
  type YajTtsVoiceId,
} from "@/lib/yaj-media";

type Props = {
  routine: CoachRoutine;
  onClose: () => void;
  onProgress: (minutesDone: number) => void;
  onPickAnother: () => void;
  onHome: () => void;
};

type Phase = "coaching" | "hold" | "finished";

const LINE_PAUSE_MS = 550;
const PREFS_KEY = "yaj_move_coach_prefs_v1";

type Prefs = {
  voice: YajTtsVoiceId;
  speed: CoachVoiceSpeedId;
  muted: boolean;
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { voice: "nova", speed: "normal", muted: false };
    const p = JSON.parse(raw) as Partial<Prefs>;
    const voice = YAJ_TTS_VOICES.some((v) => v.id === p.voice) ? (p.voice as YajTtsVoiceId) : "nova";
    const speed = COACH_VOICE_SPEEDS.some((s) => s.id === p.speed)
      ? (p.speed as CoachVoiceSpeedId)
      : "normal";
    return { voice, speed, muted: Boolean(p.muted) };
  } catch {
    return { voice: "nova", speed: "normal", muted: false };
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Personal AI Move coach:
 * One linear session runner — illustration + voice stay on the same step.
 * Never re-enters a step from stepIdx effect updates (that caused repeats).
 */
export default function MoveCoachSession({
  routine,
  onClose,
  onProgress,
  onPickAnother,
  onHome,
}: Props) {
  const steps = routine.steps;
  const figure = getWellnessFigure();
  const skinTone = getWellnessSkinTone();
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("coaching");
  const [caption, setCaption] = useState("Getting ready…");
  const [holdLeft, setHoldLeft] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Bumps only on manual restart / prev / skip — not on normal auto-advance. */
  const [sessionKey, setSessionKey] = useState(0);
  const [finish, setFinish] = useState<{
    minutes: number;
    calories: number;
    streak: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const prefsRef = useRef(prefs);
  const audioCache = useRef(new Map<string, string>());
  const loggedRef = useRef(false);
  const startedAt = useRef(Date.now());
  const stepIdxRef = useRef(0);
  const introducedRef = useRef(false);

  prefsRef.current = prefs;
  pausedRef.current = paused;
  stepIdxRef.current = stepIdx;

  const rate = COACH_VOICE_SPEEDS.find((s) => s.id === prefs.speed)?.rate ?? 1;

  const waitWhilePaused = useCallback(async (signal: AbortSignal) => {
    while (pausedRef.current) {
      await sleep(120, signal);
    }
  }, []);

  const speak = useCallback(
    async (text: string, signal: AbortSignal) => {
      setCaption(text);
      await waitWhilePaused(signal);
      if (signal.aborted) return;
      if (prefsRef.current.muted) {
        await sleep(Math.min(2400, 800 + text.length * 30), signal);
        return;
      }
      const voice = prefsRef.current.voice;
      const cacheKey = `${voice}::${text}`;
      let src = audioCache.current.get(cacheKey);
      if (!src) {
        src = await synthesizeYajVoice(text, voice);
        if (signal.aborted) return;
        audioCache.current.set(cacheKey, src);
      }
      await waitWhilePaused(signal);
      if (signal.aborted) return;

      // Keep pause/resume in sync without restarting finished clips.
      const pauseWatcher = window.setInterval(() => {
        if (signal.aborted) return;
        if (pausedRef.current) pauseYajAudio();
        else resumeYajAudio();
      }, 200);
      try {
        await playYajAudioAsync(src, { playbackRate: rate, signal });
      } finally {
        window.clearInterval(pauseWatcher);
      }
      if (signal.aborted) return;
      await sleep(LINE_PAUSE_MS, signal);
    },
    [rate, waitWhilePaused],
  );

  const tickSecond = useCallback(
    async (signal: AbortSignal) => {
      const start = Date.now();
      while (Date.now() - start < 1000) {
        await waitWhilePaused(signal);
        if (signal.aborted) return;
        await sleep(60, signal);
      }
    },
    [waitWhilePaused],
  );

  const runHold = useCallback(
    async (seconds: number, signal: AbortSignal) => {
      setPhase("hold");
      const shortHold = seconds <= 10;
      if (!shortHold) {
        setCaption(`Hold for about ${seconds} seconds…`);
      }
      for (let n = seconds; n >= 1; n--) {
        await waitWhilePaused(signal);
        if (signal.aborted) return;
        setHoldLeft(n);
        setCaption(shortHold ? `Hold… ${n}` : `Keep going… ${n}`);
        if (shortHold && (n === seconds || n === 3 || n === 1) && !prefsRef.current.muted) {
          try {
            const key = `${prefsRef.current.voice}::${n}`;
            let src = audioCache.current.get(key);
            if (!src) {
              src = await synthesizeYajVoice(String(n), prefsRef.current.voice);
              audioCache.current.set(key, src);
            }
            if (!signal.aborted && !pausedRef.current) {
              void playYajAudioAsync(src, { playbackRate: rate, signal });
            }
          } catch {
            /* visual countdown still runs */
          }
        }
        await tickSecond(signal);
      }
      setHoldLeft(null);
      setPhase("coaching");
    },
    [rate, tickSecond, waitWhilePaused],
  );

  const completeSession = useCallback(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    stopYajAudio();
    const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const minutes = Math.min(routine.minutes, Math.max(1, elapsedMin));
    onProgress(minutes);
    const streak = bumpMoveStreak();
    setFinish({
      minutes,
      calories: estimateCalories(routine, minutes),
      streak,
    });
    setPhase("finished");
  }, [onProgress, routine]);

  /** Run one step's lines + hold + bridge. Does NOT change stepIdx. */
  const runStepContent = useCallback(
    async (idx: number, signal: AbortSignal) => {
      const step = steps[idx];
      if (!step) return;
      setPhase("coaching");
      setHoldLeft(null);
      setCaption(step.lines[0] || step.title);

      for (const line of step.lines) {
        if (signal.aborted) return;
        await speak(line, signal);
      }

      if (step.holdSeconds && step.holdSeconds > 0) {
        if (signal.aborted) return;
        await runHold(step.holdSeconds, signal);
      }

      if (step.afterLine) {
        if (signal.aborted) return;
        await speak(step.afterLine, signal);
      }
    },
    [runHold, speak, steps],
  );

  /**
   * Linear session loop. Depends only on sessionKey so auto-advance cannot
   * re-enter the effect and re-speak the same step.
   */
  useEffect(() => {
    if (phase === "finished") return;
    unlockYajAudio();
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    void (async () => {
      try {
        let idx = stepIdxRef.current;

        if (!introducedRef.current) {
          introducedRef.current = true;
          await speak(
            `Okay. Let's begin. ${routine.title}. Follow the illustration — I'll coach you through each move.`,
            ac.signal,
          );
        }

        while (!ac.signal.aborted) {
          if (idx < 0 || idx >= steps.length) {
            if (!ac.signal.aborted) completeSession();
            return;
          }

          setStepIdx(idx);
          stepIdxRef.current = idx;
          await runStepContent(idx, ac.signal);
          if (ac.signal.aborted) return;

          if (idx >= steps.length - 1) {
            await speak("Great job. Workout complete. Nice work today.", ac.signal);
            if (!ac.signal.aborted) completeSession();
            return;
          }

          // Advance inside this same loop — do not bump sessionKey / re-mount effect.
          idx += 1;
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setCaption(
          e instanceof Error ? e.message : "Voice hit a snag — you can still follow the cards.",
        );
      }
    })();

    return () => {
      ac.abort();
      stopYajAudio();
    };
    // sessionKey only — step changes are handled inside the loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopYajAudio();
    },
    [],
  );

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  };

  const jumpToStep = (nextIdx: number) => {
    abortRef.current?.abort();
    stopYajAudio();
    setPaused(false);
    setHoldLeft(null);
    setPhase("coaching");
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIdx));
    stepIdxRef.current = clamped;
    setStepIdx(clamped);
    setSessionKey((k) => k + 1);
  };

  const restartStep = () => jumpToStep(stepIdxRef.current);

  const goPrev = () => {
    if (stepIdxRef.current <= 0) {
      restartStep();
      return;
    }
    jumpToStep(stepIdxRef.current - 1);
  };

  const goSkip = () => {
    if (stepIdxRef.current >= steps.length - 1) {
      abortRef.current?.abort();
      stopYajAudio();
      completeSession();
      return;
    }
    jumpToStep(stepIdxRef.current + 1);
  };

  const moodId = getTodayProgress().mood;
  const moodLabel = moodId ? MOODS.find((m) => m.id === moodId)?.label ?? null : null;

  if (finish && phase === "finished") {
    return (
      <MoveFinishScreen
        routine={routine}
        minutesDone={finish.minutes}
        calories={finish.calories}
        streak={finish.streak}
        moodLabel={moodLabel}
        onRepeat={() => {
          loggedRef.current = false;
          introducedRef.current = false;
          startedAt.current = Date.now();
          setFinish(null);
          setPhase("coaching");
          stepIdxRef.current = 0;
          setStepIdx(0);
          setSessionKey((k) => k + 1);
        }}
        onAnother={onPickAnother}
        onHome={onHome}
      />
    );
  }

  const step = steps[stepIdx];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f3f7f5] text-stone-900">
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            stopYajAudio();
            if (!loggedRef.current) {
              const elapsedMin = Math.round((Date.now() - startedAt.current) / 60000);
              if (elapsedMin >= 1) onProgress(Math.min(routine.minutes, elapsedMin));
            }
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-black">{routine.title}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">YAJ coach</p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Voice settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </header>

      {settingsOpen && (
        <div className="mx-3 mb-2 space-y-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">YAJ voice</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {YAJ_TTS_VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => updatePrefs({ voice: v.id })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    prefs.voice === v.id ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Voice speed</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COACH_VOICE_SPEEDS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => updatePrefs({ speed: s.id })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    prefs.speed === s.id ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <MoveInstructionCard
          illustration={step.illustration}
          title={step.title}
          stepNumber={stepIdx + 1}
          totalSteps={steps.length}
          figure={figure}
          skinTone={skinTone}
          holdLeft={holdLeft}
          caption={caption}
          breathCue={step.breathCue}
          safetyTip={step.safetyTip}
          animating={!paused && phase !== "hold"}
        />

        {/* Progress rail */}
        <div className="mx-auto mt-4 max-w-[340px] space-y-1.5 rounded-2xl border border-stone-200/80 bg-white/90 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Progress</p>
          {steps.map((s, i) => {
            const done = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs ${
                  current
                    ? "bg-teal-50 font-bold text-teal-900"
                    : done
                      ? "text-stone-400 line-through"
                      : "text-stone-600"
                }`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                ) : current ? (
                  <span className="shrink-0 text-teal-600">➡</span>
                ) : (
                  <span className="w-3.5 shrink-0 text-center text-stone-300">·</span>
                )}
                <span className="truncate">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-stone-200/80 bg-white/95 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
            aria-label="Previous step"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={restartStep}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
            aria-label="Repeat step"
          >
            <Repeat2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPaused((p) => {
                const next = !p;
                if (next) pauseYajAudio();
                else resumeYajAudio();
                return next;
              });
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-md"
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={() => updatePrefs({ muted: !prefs.muted })}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
            aria-label={prefs.muted ? "Unmute" : "Mute"}
          >
            {prefs.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={goSkip}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
            aria-label="Skip step"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-stone-500">
          Pause · Repeat · Previous · Skip · Mute · Voice settings
        </p>
      </div>
    </div>
  );
}
