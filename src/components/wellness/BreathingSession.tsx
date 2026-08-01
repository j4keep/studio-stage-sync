import { useEffect, useRef, useState } from "react";
import {
  canWellnessSpeak,
  speakBreathPhase,
  speakWellness,
  stopWellnessSpeak,
  warmupWellnessVoice,
} from "@/lib/wellness-voice";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
  minutes: number;
  onComplete?: () => void;
  /** Called when user closes early after ≥30s — minutes to log. */
  onProgress?: (minutesDone: number) => void;
  /** YAJ speaks phase cues. Default true when browser supports it. */
  voiceGuide?: boolean;
};

type Phase = "inhale" | "hold" | "exhale" | "holdOut";

/** Full-screen guided breathing with YAJ voice cues — no demo videos or cards. */
export default function BreathingSession({
  open,
  onClose,
  title,
  inhale,
  hold,
  exhale,
  holdOut = 0,
  minutes,
  onComplete,
  onProgress,
  voiceGuide = true,
}: Props) {
  const totalSec = minutes * 60;
  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseLeft, setPhaseLeft] = useState(inhale);
  const [secondsLeft, setSecondsLeft] = useState(totalSec);
  const [running, setRunning] = useState(true);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuide && canWellnessSpeak());
  const completedRef = useRef(false);
  const loggedRef = useRef(false);
  const secondsLeftRef = useRef(totalSec);
  const phaseRef = useRef<Phase>("inhale");

  const recordProgress = (full: boolean) => {
    if (loggedRef.current) return;
    const done = Math.max(0, totalSec - secondsLeftRef.current);
    if (!full && done < 30) return;
    loggedRef.current = true;
    const mins = full ? minutes : Math.max(1, Math.round(done / 60));
    onProgress?.(mins);
  };

  const phases: Phase[] = (["inhale", "hold", "exhale", "holdOut"] as Phase[]).filter((p) => {
    if (p === "hold") return hold > 0;
    if (p === "holdOut") return holdOut > 0;
    return true;
  });

  const durationFor = (p: Phase) =>
    p === "inhale" ? inhale : p === "hold" ? hold : p === "exhale" ? exhale : holdOut;

  useEffect(() => {
    if (!open) return;
    warmupWellnessVoice();
    completedRef.current = false;
    setPhase("inhale");
    phaseRef.current = "inhale";
    setPhaseLeft(inhale);
    setSecondsLeft(totalSec);
    secondsLeftRef.current = totalSec;
    setRunning(true);
    completedRef.current = false;
    loggedRef.current = false;
    if (voiceGuide && canWellnessSpeak()) {
      void speakWellness(`Let's begin. ${title}. Breathe in.`, { calm: true, rate: 0.9 });
    }
    return () => {
      stopWellnessSpeak();
    };
  }, [open, inhale, minutes, title, voiceGuide, totalSec]);

  useEffect(() => {
    if (!open || !running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        const next = s <= 1 ? 0 : s - 1;
        secondsLeftRef.current = next;
        if (s <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            recordProgress(true);
            if (voiceOn) void speakWellness("Well done. Session complete.", { calm: true });
            onComplete?.();
          }
          setRunning(false);
          return 0;
        }
        return next;
      });
      setPhaseLeft((t) => {
        if (t > 1) return t - 1;
        const current = phaseRef.current;
        const idx = phases.indexOf(current);
        const next = phases[(idx + 1) % phases.length];
        phaseRef.current = next;
        setPhase(next);
        const dur = durationFor(next);
        if (voiceOn) void speakBreathPhase(next);
        return dur;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, voiceOn, onComplete]);

  useEffect(() => {
    if (!open) stopWellnessSpeak();
  }, [open]);

  if (!open) return null;

  const label =
    phase === "inhale" ? "Breathe in" : phase === "hold" ? "Hold" : phase === "exhale" ? "Breathe out" : "Hold";
  const scale = phase === "inhale" || phase === "hold" ? 1.15 : 0.88;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const progress = ((totalSec - secondsLeft) / totalSec) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0c1a17] text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_0%,rgba(45,212,191,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:18px_18px]" />
      <header className="relative z-10 flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      <div className="relative z-10 mx-4 mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-teal-400 transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-4 pb-6 pt-2">
        <p className="text-5xl font-black tabular-nums tracking-tight text-white/90">
          {mm}:{ss}
        </p>
        <div
          className="flex h-52 w-52 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/40 via-emerald-400/30 to-cyan-500/20 shadow-[0_0_60px_-12px_rgba(45,212,191,0.55)] transition-transform duration-[1000ms] ease-in-out"
          style={{ transform: `scale(${running && secondsLeft > 0 ? scale : 1})` }}
        >
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#0c1a17]/70 backdrop-blur">
            <p className="text-base font-black tracking-tight">
              {secondsLeft === 0 ? "Complete" : label}
            </p>
            {secondsLeft > 0 && (
              <p className="mt-1 text-3xl font-bold tabular-nums text-teal-200">
                {Math.max(phaseLeft, 1)}
              </p>
            )}
          </div>
        </div>
        <p className="max-w-xs text-center text-sm leading-relaxed text-emerald-100/75">
          {secondsLeft === 0
            ? "Beautiful work. Carry this ease with you."
            : voiceOn
              ? "YAJ is guiding your breath. Follow the circle."
              : "Follow the circle. No perfect pace — just stay with the breath."}
        </p>
        {secondsLeft > 0 && (
          <button
            type="button"
            onClick={() => {
              if (running) stopWellnessSpeak();
              setRunning((r) => !r);
            }}
            className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-bold"
          >
            {running ? "Pause" : "Resume"}
          </button>
        )}
        {secondsLeft === 0 && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-teal-400 px-6 py-2.5 text-sm font-black text-teal-950"
          >
            Nice work
          </button>
        )}
      </div>
    </div>
  );
}
