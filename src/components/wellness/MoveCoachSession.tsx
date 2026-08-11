import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  ListMusic,
  Music2,
  Square,

  Pause,
  Play,
  Repeat2,
  Settings2,
  SkipForward,
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
} from "@/lib/wellness-move-coach";
import {
  bumpMoveDayStats,
  completionCoachLine,
  levelLabel,
} from "@/lib/wellness-move-meta";
import { wellnessAmbient } from "@/lib/wellness-ambient-engine";
import {
  getTodayProgress,
  getWellnessFigure,
  getWellnessSkinTone,
  MOODS,
  WELLNESS_UPDATED_EVENT,
} from "@/lib/wellness";
import {
  loadWellnessCoachPrefs,
  saveWellnessCoachPrefs,
  type WellnessCoachPrefs,
} from "@/lib/wellness-coach-prefs";
import {
  pauseYajAudio,
  playYajAudioAsync,
  resumeYajAudio,
  stopYajAudio,
  synthesizeYajVoice,
  unlockYajAudio,
  YAJ_TTS_VOICES,
} from "@/lib/yaj-media";
import { useNavigate } from "react-router-dom";
import { usePlaylists } from "@/contexts/PlaylistContext";
import {
  getWorkoutPlaylistId,
  workoutMusic,
  WORKOUT_PLAYLIST_EVENT,
  type WorkoutMusicState,
} from "@/lib/workout-music";


type Props = {
  routine: CoachRoutine;
  onClose: () => void;
  onProgress: (minutesDone: number) => void;
  onPickAnother: () => void;
  onHome: () => void;
  onStartAnother?: (id: string) => void;
};

type Phase = "coaching" | "hold" | "finished";

const LINE_PAUSE_MS = 550;

type Prefs = WellnessCoachPrefs;

function loadPrefs(): Prefs {
  return loadWellnessCoachPrefs();
}

function savePrefs(p: Prefs) {
  saveWellnessCoachPrefs(p);
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
  onStartAnother,
}: Props) {
  const steps = routine.steps;
  const [figure, setFigure] = useState(() => getWellnessFigure());
  const [skinTone, setSkinTone] = useState(() => getWellnessSkinTone());
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("coaching");
  const [caption, setCaption] = useState("Getting ready…");
  const [holdLeft, setHoldLeft] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bgSound, setBgSound] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
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

  useEffect(() => {
    const refreshProfile = () => {
      setFigure(getWellnessFigure());
      setSkinTone(getWellnessSkinTone());
    };
    window.addEventListener(WELLNESS_UPDATED_EVENT, refreshProfile);
    return () => window.removeEventListener(WELLNESS_UPDATED_EVENT, refreshProfile);
  }, []);

  /* ---------------- Workout music (playlist from Radio) ---------------- */
  const navigate = useNavigate();
  const { playlists, loadPlaylists } = usePlaylists();
  const [music, setMusic] = useState<WorkoutMusicState>(() => workoutMusic.state);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [workoutPlaylistId, setWorkoutPlaylistId] = useState<string | null>(() =>
    getWorkoutPlaylistId(),
  );


  useEffect(() => {
    const off = workoutMusic.subscribe(setMusic);
    return () => {
      off();
    };
  }, []);


  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    const sync = () => setWorkoutPlaylistId(getWorkoutPlaylistId());
    window.addEventListener(WORKOUT_PLAYLIST_EVENT, sync);
    return () => window.removeEventListener(WORKOUT_PLAYLIST_EVENT, sync);
  }, []);

  const workoutPlaylist = playlists.find((p) => p.id === workoutPlaylistId) || null;

  /** Keep the shuffled queue in sync with the chosen playlist. */
  useEffect(() => {
    if (!workoutPlaylist) return;
    workoutMusic.setQueue(
      workoutPlaylist.items.map((i) => ({
        id: i.id,
        title: i.title,
        artist: i.artist,
        image: i.image,
        audioUrl: i.audioUrl,
      })),
    );
  }, [workoutPlaylist?.id, workoutPlaylist?.items.length]);

  useEffect(() => () => workoutMusic.stop(), []);

  /** Session pause also pauses the music; resuming brings it back. */
  const musicWasPlaying = useRef(false);
  useEffect(() => {
    if (paused) {
      musicWasPlaying.current = workoutMusic.state.playing;
      if (musicWasPlaying.current) workoutMusic.pause();
    } else if (musicWasPlaying.current) {
      musicWasPlaying.current = false;
      void workoutMusic.play();
    }
  }, [paused]);

  const toggleWorkoutMusic = () => {
    unlockYajAudio();
    void workoutMusic.toggle();
  };




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

      // Only toggle pause/resume on state changes — polling resume() on a
      // finished clip can restart the same line (sounded like a double-speak).
      let wasPaused = pausedRef.current;
      if (wasPaused) pauseYajAudio();
      const pauseWatcher = window.setInterval(() => {
        if (signal.aborted) return;
        const nowPaused = pausedRef.current;
        if (nowPaused === wasPaused) return;
        wasPaused = nowPaused;
        if (nowPaused) pauseYajAudio();
        else resumeYajAudio();
      }, 200);
      try {
        // Duck the workout playlist so the coach voice stays on top.
        workoutMusic.duck();
        await playYajAudioAsync(src, { playbackRate: rate, signal });
      } finally {
        workoutMusic.unduck();
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
              workoutMusic.duck();
              void playYajAudioAsync(src, { playbackRate: rate, signal }).finally(() =>
                workoutMusic.unduck(),
              );
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

  useEffect(() => {
    if (phase === "finished") return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, sessionKey]);

  useEffect(() => {
    return () => {
      void wellnessAmbient.stop();
    };
  }, []);

  const completeSession = useCallback(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    stopYajAudio();
    void wellnessAmbient.stop();
    workoutMusic.stop();
    setBgSound(false);

    const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const minutes = Math.min(routine.minutes, Math.max(1, elapsedMin));
    onProgress(minutes);
    const streak = bumpMoveStreak();
    const calories = estimateCalories(routine, minutes);
    bumpMoveDayStats(minutes, calories, routine.id);
    setFinish({
      minutes,
      calories,
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
            const elapsedMin = Math.max(
              1,
              Math.round((Date.now() - startedAt.current) / 60000),
            );
            const mins = Math.min(routine.minutes, elapsedMin);
            await speak(completionCoachLine(routine, mins), ac.signal);
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
          setElapsedSec(0);
          setFinish(null);
          setPhase("coaching");
          stepIdxRef.current = 0;
          setStepIdx(0);
          setSessionKey((k) => k + 1);
        }}
        onAnother={onPickAnother}
        onHome={onHome}
        onStartAnother={onStartAnother}
      />
    );
  }

  const step = steps[stepIdx];
  const totalSec = routine.minutes * 60;
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const ringPct = Math.min(100, ((stepIdx + (phase === "hold" ? 0.5 : 0.2)) / steps.length) * 100);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleBgSound = async () => {
    if (bgSound) {
      await wellnessAmbient.stop();
      setBgSound(false);
      return;
    }
    try {
      unlockYajAudio();
      await wellnessAmbient.playTrack("gentle-breeze", { volume: 0.18, loop: true });
      setBgSound(true);
    } catch {
      setBgSound(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f3f7f5] text-stone-900">
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            stopYajAudio();
            void wellnessAmbient.stop();
            workoutMusic.stop();

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

      {/* Progress ring + timers */}
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2.5 shadow-sm">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e7e5e4" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#0d9488"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${ringPct} 100`}
            />
          </svg>
          <span className="absolute text-[11px] font-black text-teal-800">
            {stepIdx + 1}/{steps.length}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Session</p>
          <p className="truncate text-sm font-black">{step.title}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-stone-500">
            {fmt(elapsedSec)} elapsed · {fmt(remainingSec)} left
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Focus</p>
          <p className="text-xs font-bold text-teal-700">
            {routine.targets[0] || "Full Body"}
          </p>
        </div>
      </div>

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
          difficultyLabel={levelLabel(routine.level)}
          targets={routine.targets}
          holdSeconds={step.holdSeconds}
        />

        {/* Progress rail */}
        <div className="mx-auto mt-4 max-w-[340px] space-y-1.5 rounded-2xl border border-stone-200/80 bg-white/90 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Step progress</p>
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

      {/* Workout music strip — playlist built in Radio, auto-ducked when coach talks */}
      <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2 shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-teal-50 text-teal-700">
          {music.track?.image ? (
            <img src={music.track.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Dumbbell className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
            Workout music{music.ducked && music.playing ? " · lowered" : ""}
          </p>
          {workoutPlaylist && music.queueLength > 0 ? (
            <p className="truncate text-xs font-black text-stone-900">
              {music.track ? `${music.track.title} · ${music.track.artist}` : workoutPlaylist.name}
            </p>
          ) : (
            <p className="truncate text-[11px] font-semibold text-stone-500">
              {workoutPlaylist
                ? "No playable songs in this playlist yet"
                : "Tap “Pick songs” to build your workout playlist"}
            </p>
          )}
        </div>
        {workoutPlaylist && music.queueLength > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMusicPickerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
              aria-label="Edit workout playlist songs"
            >
              <ListMusic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleWorkoutMusic}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white"
              aria-label={music.playing ? "Pause workout music" : "Play workout music"}
            >
              {music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void workoutMusic.next()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
              aria-label="Next song"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => workoutMusic.stop()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
              aria-label="Stop workout music"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMusicPickerOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            <ListMusic className="h-3.5 w-3.5" /> Pick songs
          </button>
        )}

      </div>

      <WorkoutPlaylistSheet
        open={musicPickerOpen}
        onClose={() => {
          setMusicPickerOpen(false);
          setWorkoutPlaylistId(getWorkoutPlaylistId());
        }}
        playlistId={workoutPlaylistId}
      />


      {/* Controls */}
      <div className="border-t border-stone-200/80 bg-white/95 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5">

        <div className="mx-auto flex max-w-md items-center justify-between gap-1.5">
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
            aria-label="Replay step"
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
            aria-label={prefs.muted ? "Unmute voice" : "Mute voice"}
          >
            {prefs.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleBgSound()}
            className={`flex h-11 w-11 items-center justify-center rounded-full border ${
              bgSound
                ? "border-teal-300 bg-teal-50 text-teal-800"
                : "border-stone-200 bg-stone-50"
            }`}
            aria-label={bgSound ? "Stop background sound" : "Play background sound"}
          >
            <Music2 className="h-4 w-4" />
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
          Pause · Replay · Skip · Voice · Background sound
        </p>
      </div>
    </div>
  );
}
