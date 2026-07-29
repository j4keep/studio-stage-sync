import { useEffect, useRef, useState } from "react";

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
};

type Phase = "inhale" | "hold" | "exhale" | "holdOut";

/** Full-screen guided breathing — calm, timer-based. */
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
}: Props) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseLeft, setPhaseLeft] = useState(inhale);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(true);
  const completedRef = useRef(false);

  const phases: Phase[] = (["inhale", "hold", "exhale", "holdOut"] as Phase[]).filter((p) => {
    if (p === "hold") return hold > 0;
    if (p === "holdOut") return holdOut > 0;
    return true;
  });

  const durationFor = (p: Phase) =>
    p === "inhale" ? inhale : p === "hold" ? hold : p === "exhale" ? exhale : holdOut;

  useEffect(() => {
    if (!open) return;
    completedRef.current = false;
    setPhase("inhale");
    setPhaseLeft(inhale);
    setSecondsLeft(minutes * 60);
    setRunning(true);
  }, [open, inhale, minutes]);

  useEffect(() => {
    if (!open || !running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
      setPhaseLeft((t) => {
        if (t > 1) return t - 1;
        setPhase((p) => {
          const idx = phases.indexOf(p);
          const next = phases[(idx + 1) % phases.length];
          queueMicrotask(() => setPhaseLeft(durationFor(next)));
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // phases/durations intentionally stable per open session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, onComplete]);

  if (!open) return null;

  const label =
    phase === "inhale" ? "Breathe in" : phase === "hold" ? "Hold" : phase === "exhale" ? "Breathe out" : "Hold";
  const scale = phase === "inhale" || phase === "hold" ? 1.15 : 0.88;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0c1a17] text-emerald-50">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"
        >
          Close
        </button>
        <p className="text-sm font-bold">{title}</p>
        <span className="w-14 text-right text-xs tabular-nums text-emerald-100/70">
          {mm}:{ss}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/40 via-emerald-400/30 to-cyan-500/20 shadow-[0_0_60px_-12px_rgba(45,212,191,0.55)] transition-transform duration-[1000ms] ease-in-out"
          style={{ transform: `scale(${running ? scale : 1})` }}
        >
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#0c1a17]/70 backdrop-blur">
            <p className="text-lg font-black tracking-tight">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-200">{Math.max(phaseLeft, 1)}</p>
          </div>
        </div>
        <p className="max-w-xs text-center text-sm text-emerald-100/70">
          Follow the circle. No perfect pace — just stay with the breath.
        </p>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-bold"
        >
          {running ? "Pause" : secondsLeft === 0 ? "Done" : "Resume"}
        </button>
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
