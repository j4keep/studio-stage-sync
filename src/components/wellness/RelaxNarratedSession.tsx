import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import type { NarratedSession } from "@/lib/wellness-relax";
import {
  canWellnessSpeak,
  speakWellness,
  stopWellnessSpeak,
  warmupWellnessVoice,
} from "@/lib/wellness-voice";

type Props = {
  session: NarratedSession;
  onClose: () => void;
  onComplete?: () => void;
};

/**
 * Narrated YAJ voice session — mental resets & relaxation techniques.
 * Not a chat; scripted lines with on-screen guidance.
 */
export default function RelaxNarratedSession({ session, onClose, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(true);
  const [left, setLeft] = useState(session.steps[0]?.holdSeconds ?? 8);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);
  const step = session.steps[stepIdx];
  const progress = ((stepIdx + (done ? 1 : 0)) / session.steps.length) * 100;

  useEffect(() => {
    abortRef.current = false;
    warmupWellnessVoice();
    setStepIdx(0);
    setLeft(session.steps[0]?.holdSeconds ?? 8);
    setRunning(true);
    setDone(false);
    return () => {
      abortRef.current = true;
      stopWellnessSpeak();
    };
  }, [session.id]);

  useEffect(() => {
    if (done || !running || !step) return;
    if (canWellnessSpeak()) {
      void speakWellness(step.speak, { calm: true, rate: 0.92, interrupt: true });
    }
    setLeft(step.holdSeconds);
  }, [stepIdx, session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running || done || !step) return;
    const id = window.setInterval(() => {
      setLeft((t) => {
        if (t > 1) return t - 1;
        if (stepIdx >= session.steps.length - 1) {
          setDone(true);
          setRunning(false);
          stopWellnessSpeak();
          if (canWellnessSpeak()) {
            void speakWellness("Well done. Take that calm with you.", { calm: true });
          }
          onComplete?.();
          return 0;
        }
        setStepIdx((i) => i + 1);
        return session.steps[stepIdx + 1]?.holdSeconds ?? 8;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, done, stepIdx, step, session.steps, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1614] text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_10%,rgba(45,212,191,0.18),transparent_50%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            stopWellnessSpeak();
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold">
          {session.emoji} {session.title}
        </p>
        <span className="text-xs font-bold text-teal-200/80">{session.minutes} min</span>
      </header>

      <div className="relative z-10 mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-teal-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-300/80">
          {done ? "Complete" : `Step ${stepIdx + 1} of ${session.steps.length}`}
        </p>
        <div className="mt-6 flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/30 via-emerald-400/20 to-cyan-500/15 shadow-[0_0_50px_-12px_rgba(45,212,191,0.5)]">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#0b1614]/75">
            {done ? (
              <p className="text-sm font-black">Done</p>
            ) : (
              <>
                <p className="text-3xl font-black tabular-nums text-teal-100">{left}</p>
                <p className="text-[10px] font-semibold text-teal-200/70">sec</p>
              </>
            )}
          </div>
        </div>
        <p className="mt-8 max-w-sm text-center text-xl font-black leading-snug tracking-tight">
          {done ? "Carry this calm with you." : step?.text}
        </p>
        <p className="mt-3 max-w-xs text-center text-xs text-emerald-100/55">
          YAJ is guiding out loud — listen or follow the words on screen.
        </p>

        <div className="mt-8 flex gap-3">
          {!done ? (
            <button
              type="button"
              onClick={() => {
                if (running) stopWellnessSpeak();
                setRunning((r) => !r);
              }}
              className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : "Resume"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-teal-400 px-6 py-3 text-sm font-black text-teal-950"
            >
              Nice work
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
