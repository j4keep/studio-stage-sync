import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
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
  steps: string[];
  onComplete?: () => void;
  onClose: () => void;
  /** YAJ Buddy speaks each step. Default true when supported. */
  voiceGuide?: boolean;
};

/**
 * Workout timer with Buddy coaching.
 * Speaks EVERY step in order (queued) so longer routines don’t skip instructions.
 */
export default function WorkoutTimer({
  minutes,
  title,
  steps,
  onComplete,
  onClose,
  voiceGuide = true,
}: Props) {
  const total = Math.max(60, minutes * 60);
  const stepCount = Math.max(1, steps.length);
  // Equal time per step so none are skipped; leftover seconds stay on last step
  const secondsPerStep = Math.max(8, Math.floor(total / stepCount));

  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuide && canWellnessSpeak());
  const lastSpokenStep = useRef<number>(-1);
  const completedRef = useRef(false);
  const speakQueueBusy = useRef(false);
  const pendingSteps = useRef<number[]>([]);

  const flushSpeakQueue = async () => {
    if (speakQueueBusy.current) return;
    speakQueueBusy.current = true;
    while (pendingSteps.current.length) {
      const idx = pendingSteps.current.shift()!;
      if (!voiceOn) continue;
      lastSpokenStep.current = idx;
      await speakMoveStep(idx, steps[idx] || "", stepCount);
      // Brief pause between cues so Chrome doesn’t drop the queue
      await new Promise((r) => setTimeout(r, 280));
    }
    speakQueueBusy.current = false;
  };

  const enqueueStepSpeak = (idx: number) => {
    if (!voiceOn) return;
    if (idx < 0 || idx >= stepCount) return;
    // Don’t re-queue a step already spoken or already waiting
    if (idx <= lastSpokenStep.current) return;
    if (pendingSteps.current.includes(idx)) return;
    // If we jumped ahead (tab throttle), backfill any skipped steps
    for (let i = lastSpokenStep.current + 1; i <= idx; i++) {
      if (!pendingSteps.current.includes(i)) pendingSteps.current.push(i);
    }
    void flushSpeakQueue();
  };

  useEffect(() => {
    warmupWellnessVoice();
    setLeft(total);
    setRunning(true);
    setStepIdx(0);
    lastSpokenStep.current = -1;
    completedRef.current = false;
    pendingSteps.current = [];
    speakQueueBusy.current = false;

    let cancelled = false;
    void (async () => {
      if (voiceGuide && canWellnessSpeak()) {
        const voiceName = getSelectedWellnessVoiceName();
        await speakWellness(
          voiceName
            ? `Okay. Let's begin. ${title}. I'll guide you through each step.`
            : `Okay. Let's begin. ${title}.`,
          { calm: true, rate: 0.86, interrupt: true },
        );
        if (!cancelled) enqueueStepSpeak(0);
      }
    })();

    return () => {
      cancelled = true;
      pendingSteps.current = [];
      stopWellnessSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, title, voiceGuide]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
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
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, voiceOn, onComplete]);

  // Advance highlighted step + speak every step (including any that were skipped by lag)
  useEffect(() => {
    if (!steps.length || left < 0) return;
    const elapsed = total - left;
    const nextIdx = Math.min(stepCount - 1, Math.floor(elapsed / secondsPerStep));
    setStepIdx(nextIdx);
    if (voiceOn && running && left > 0) {
      enqueueStepSpeak(nextIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, total, secondsPerStep, stepCount, voiceOn, running]);

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
              aria-label={voiceOn ? "Mute Buddy voice" : "Enable Buddy voice"}
            >
              {voiceOn ? "Voice on" : "Voice off"}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 pt-4">
        <p className="text-center text-5xl font-black tabular-nums tracking-tight">
          {mm}:{ss}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-center text-[11px] text-emerald-100/50">
          Step {stepIdx + 1} of {stepCount}
        </p>

        <div className="mt-6 flex-1 space-y-2 overflow-y-auto pb-6">
          {steps.map((step, i) => (
            <div
              key={`${i}-${step}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                i === stepIdx
                  ? "border-teal-300/50 bg-teal-400/15 font-semibold text-teal-50"
                  : i < stepIdx
                    ? "border-white/5 bg-white/5 text-emerald-100/45 line-through"
                    : "border-white/10 bg-white/5 text-emerald-100/80"
              }`}
            >
              <span className="mr-2 text-[10px] font-bold uppercase tracking-wide opacity-60">{i + 1}</span>
              {step}
            </div>
          ))}
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
