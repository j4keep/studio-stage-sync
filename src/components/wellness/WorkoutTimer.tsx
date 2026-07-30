import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import ExerciseDemoPlayer from "@/components/wellness/ExerciseDemoPlayer";
import type { MoveRoutine, MoveStep, WellnessFigure } from "@/lib/wellness";
import { demoForStep, getWellnessFigure, moveStepText } from "@/lib/wellness";
import {
  canWellnessSpeak,
  getSelectedWellnessVoiceName,
  speakMoveStep,
  speakWellness,
  stopWellnessSpeak,
  warmupWellnessVoice,
} from "@/lib/wellness-voice";

type Props = {
  minutes: number;
  title: string;
  steps: MoveStep[];
  kind?: MoveRoutine["kind"];
  figure?: WellnessFigure;
  /** Called with minutes actually done (full or partial ≥30s). */
  onProgress?: (minutesDone: number) => void;
  onComplete?: () => void;
  onClose: () => void;
  /** YAJ speaks each step. Default true when supported. */
  voiceGuide?: boolean;
};

/**
 * Workout timer with YAJ coaching + step-synced form guide cards.
 * Walk / longer moves support Pause + Next so you advance when ready.
 */
export default function WorkoutTimer({
  minutes,
  title,
  steps,
  kind = "stretch",
  figure: figureProp,
  onProgress,
  onComplete,
  onClose,
  voiceGuide = true,
}: Props) {
  const figure = figureProp ?? getWellnessFigure();
  const total = Math.max(60, minutes * 60);
  const stepCount = Math.max(1, steps.length);
  const secondsPerStep = Math.max(8, Math.floor(total / stepCount));
  const manualAdvance = kind === "walk" || kind === "bodyweight";

  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuide && canWellnessSpeak());
  const lastSpokenStep = useRef<number>(-1);
  const completedRef = useRef(false);
  const loggedRef = useRef(false);
  const leftRef = useRef(total);
  const speakQueueBusy = useRef(false);
  const pendingSteps = useRef<number[]>([]);
  const stepIdxRef = useRef(0);

  const recordProgress = (full: boolean) => {
    if (loggedRef.current) return;
    const doneSec = Math.max(0, total - leftRef.current);
    if (!full && doneSec < 30) return;
    loggedRef.current = true;
    const mins = full ? minutes : Math.max(1, Math.round(doneSec / 60));
    onProgress?.(mins);
  };

  const current = steps[stepIdx];
  const currentText = current ? moveStepText(current) : "";

  const flushSpeakQueue = async () => {
    if (speakQueueBusy.current) return;
    speakQueueBusy.current = true;
    while (pendingSteps.current.length) {
      const idx = pendingSteps.current.shift()!;
      if (!voiceOn) continue;
      lastSpokenStep.current = idx;
      const step = steps[idx];
      const text = moveStepText(step);
      await speakMoveStep(idx, text, stepCount, {
        holdSeconds: step.holdSeconds,
        coachHint: step.coachHint,
        kind,
      });
      await new Promise((r) => setTimeout(r, 280));
    }
    speakQueueBusy.current = false;
  };

  const enqueueStepSpeak = (idx: number) => {
    if (!voiceOn) return;
    if (idx < 0 || idx >= stepCount) return;
    if (idx <= lastSpokenStep.current) return;
    if (pendingSteps.current.includes(idx)) return;
    for (let i = lastSpokenStep.current + 1; i <= idx; i++) {
      if (!pendingSteps.current.includes(i)) pendingSteps.current.push(i);
    }
    void flushSpeakQueue();
  };

  const goToStep = (idx: number) => {
    const next = Math.max(0, Math.min(stepCount - 1, idx));
    stepIdxRef.current = next;
    setStepIdx(next);
    // Jump timer into that step’s window so auto-progress stays aligned
    const targetLeft = Math.max(1, total - next * secondsPerStep - 1);
    leftRef.current = targetLeft;
    setLeft(targetLeft);
    if (voiceOn) {
      // Allow re-speak of this step when user taps Next
      if (next > lastSpokenStep.current) enqueueStepSpeak(next);
      else {
        lastSpokenStep.current = next - 1;
        enqueueStepSpeak(next);
      }
    }
  };

  useEffect(() => {
    warmupWellnessVoice();
    setLeft(total);
    setRunning(true);
    setStepIdx(0);
    stepIdxRef.current = 0;
    lastSpokenStep.current = -1;
    completedRef.current = false;
    loggedRef.current = false;
    leftRef.current = total;
    pendingSteps.current = [];
    speakQueueBusy.current = false;

    let cancelled = false;
    void (async () => {
      if (voiceGuide && canWellnessSpeak()) {
        const voiceName = getSelectedWellnessVoiceName();
        const intro =
          kind === "walk"
            ? `Okay. Let's begin. ${title}. Follow the guide card. Pause or tap Next whenever you want the next cue.`
            : kind === "stretch"
              ? `Okay. Let's begin. ${title}. Follow the stretch card, and I'll tell you how long to hold.`
              : `Okay. Let's begin. ${title}. Watch the guide and follow along.`;
        await speakWellness(voiceName ? intro : intro, {
          calm: true,
          rate: 0.86,
          interrupt: true,
        });
        if (!cancelled) enqueueStepSpeak(0);
      }
    })();

    return () => {
      cancelled = true;
      pendingSteps.current = [];
      stopWellnessSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, title, voiceGuide, kind]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        const next = s <= 1 ? 0 : s - 1;
        leftRef.current = next;
        if (s <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            recordProgress(true);
            if (voiceOn) {
              void speakWellness("Great job. Workout complete. Nice work today.", {
                calm: true,
                rate: 0.86,
                interrupt: false,
              });
            }
            onComplete?.();
          }
          setRunning(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // recordProgress is stable for this session instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, voiceOn, onComplete]);

  useEffect(() => {
    if (!steps.length || left < 0) return;
    if (manualAdvance) {
      // Timer still runs for overall session; step index is user-driven via Next
      // but also soft-advances if they never tap.
      const elapsed = total - left;
      const autoIdx = Math.min(stepCount - 1, Math.floor(elapsed / secondsPerStep));
      if (autoIdx > stepIdxRef.current) {
        stepIdxRef.current = autoIdx;
        setStepIdx(autoIdx);
        if (voiceOn && running && left > 0) enqueueStepSpeak(autoIdx);
      }
      return;
    }
    const elapsed = total - left;
    const nextIdx = Math.min(stepCount - 1, Math.floor(elapsed / secondsPerStep));
    stepIdxRef.current = nextIdx;
    setStepIdx(nextIdx);
    if (voiceOn && running && left > 0) {
      enqueueStepSpeak(nextIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, total, secondsPerStep, stepCount, voiceOn, running, manualAdvance]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const pct = total ? ((total - left) / total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f1c18] text-emerald-50">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            stopWellnessSpeak();
            recordProgress(false);
            onClose();
          }}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"
        >
          Close
        </button>
        <p className="truncate text-sm font-bold">{title}</p>
        <div className="flex items-center gap-2">
          {canWellnessSpeak() && (
            <button
              type="button"
              onClick={() => {
                if (voiceOn) stopWellnessSpeak();
                setVoiceOn((v) => !v);
              }}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                voiceOn ? "bg-teal-400/30 text-teal-100" : "bg-white/10 text-white/50"
              }`}
              aria-label={voiceOn ? "Mute YAJ voice" : "Enable YAJ voice"}
            >
              {voiceOn ? "Voice on" : "Voice off"}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-2">
        <ExerciseDemoPlayer
          demo={demoForStep(current)}
          caption={currentText}
          stepLabel={`Step ${stepIdx + 1} / ${stepCount}`}
          playing={running && left > 0}
          figure={figure}
          holdSeconds={current?.holdSeconds}
          className="shrink-0 shadow-lg"
        />

        <p className="mt-3 text-center text-4xl font-black tabular-nums tracking-tight">
          {mm}:{ss}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-3">
          {steps.map((step, i) => {
            const text = moveStepText(step);
            return (
              <div
                key={`${i}-${text}`}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  i === stepIdx
                    ? "border-teal-300/50 bg-teal-400/15 font-semibold text-teal-50"
                    : i < stepIdx
                      ? "border-white/5 bg-white/5 text-emerald-100/45 line-through"
                      : "border-white/10 bg-white/5 text-emerald-100/80"
                }`}
              >
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wide opacity-60">{i + 1}</span>
                {text}
                {step.holdSeconds ? (
                  <span className="ml-1 text-[10px] text-teal-200/70">· {step.holdSeconds}s</span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              if (running) stopWellnessSpeak();
              setRunning((r) => !r);
            }}
            disabled={left === 0}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-400 text-sm font-black text-teal-950 disabled:opacity-40"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {left === 0 ? "Complete" : running ? "Pause" : "Resume"}
          </button>
          {left > 0 && stepIdx < stepCount - 1 && (
            <button
              type="button"
              onClick={() => {
                setRunning(true);
                goToStep(stepIdx + 1);
              }}
              className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-bold"
            >
              <SkipForward className="h-4 w-4" />
              Next
            </button>
          )}
          {left === 0 && (
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-full border border-white/20 px-5 text-sm font-bold"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
