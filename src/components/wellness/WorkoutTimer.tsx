import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

type Props = {
  minutes: number;
  title: string;
  steps: string[];
  onComplete?: () => void;
  onClose: () => void;
};

/** Simple workout / movement timer with step list. */
export default function WorkoutTimer({ minutes, title, steps, onComplete, onClose }: Props) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    setLeft(total);
    setRunning(true);
    setStepIdx(0);
  }, [total, title]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setRunning(false);
          onComplete?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, onComplete]);

  useEffect(() => {
    if (!steps.length || left <= 0) return;
    const elapsed = total - left;
    const per = Math.max(1, Math.floor(total / steps.length));
    setStepIdx(Math.min(steps.length - 1, Math.floor(elapsed / per)));
  }, [left, total, steps.length]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const pct = total ? ((total - left) / total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f1c18] text-emerald-50">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
          Close
        </button>
        <p className="text-sm font-bold">{title}</p>
        <span className="w-14" />
      </header>

      <div className="flex flex-1 flex-col px-5 pt-4">
        <p className="text-center text-5xl font-black tabular-nums tracking-tight">
          {mm}:{ss}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-8 flex-1 space-y-2 overflow-y-auto pb-6">
          {steps.map((step, i) => (
            <div
              key={step}
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
            onClick={() => setRunning((r) => !r)}
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
