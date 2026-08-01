import { useMemo, useState } from "react";
import { Check, Flame, Footprints, RotateCcw, Sparkles } from "lucide-react";
import type { CoachRoutine } from "@/lib/wellness-move-coach";
import {
  completionCoachLine,
  suggestNextRoutine,
} from "@/lib/wellness-move-meta";

type Feeling = "better" | "same" | "stiff";

type Props = {
  routine: CoachRoutine;
  minutesDone: number;
  calories: number;
  streak: number;
  moodLabel?: string | null;
  onRepeat: () => void;
  onAnother: () => void;
  onHome: () => void;
  onStartAnother?: (id: string) => void;
};

export default function MoveFinishScreen({
  routine,
  minutesDone,
  calories,
  streak,
  moodLabel,
  onRepeat,
  onAnother,
  onHome,
  onStartAnother,
}: Props) {
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const next = useMemo(() => suggestNextRoutine(routine.id), [routine.id]);
  const coachLine = useMemo(
    () => completionCoachLine(routine, minutesDone),
    [routine, minutesDone],
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#0f1c18] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(45,212,191,0.2),transparent_50%)]" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-400/20 text-3xl">
            🎉
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Great job!</h1>
          <p className="mt-2 text-sm text-emerald-100/75">You completed</p>
          <p className="mt-1 text-lg font-black text-white">{routine.title}</p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Stat icon={Check} label="Exercises" value={`${routine.steps.length}`} />
          <Stat icon={Flame} label="Calories" value={`${calories}`} />
          <Stat icon={Footprints} label="Minutes" value={`${minutesDone}`} />
          <Stat
            icon={Sparkles}
            label="Streak"
            value={`${streak} day${streak === 1 ? "" : "s"}`}
          />
        </div>

        <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm leading-relaxed text-emerald-50/90">
          {coachLine}
        </p>

        <div className="mt-6">
          <p className="text-center text-sm font-bold text-white">⭐ Feeling better?</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                { id: "better" as const, label: "Yes", emoji: "😊" },
                { id: "same" as const, label: "Same", emoji: "😐" },
                { id: "stiff" as const, label: "Still stiff", emoji: "😣" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFeeling(f.id)}
                className={`rounded-2xl border px-2 py-3 text-center ${
                  feeling === f.id
                    ? "border-teal-300 bg-teal-400/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="mt-1 block text-[11px] font-bold">{f.label}</span>
              </button>
            ))}
          </div>
          {moodLabel ? (
            <p className="mt-2 text-center text-[11px] text-emerald-100/45">
              Today’s mood check-in: {moodLabel}
            </p>
          ) : null}
        </div>

        {next ? (
          <button
            type="button"
            onClick={() => (onStartAnother ? onStartAnother(next.id) : onAnother())}
            className="mt-6 w-full rounded-2xl border border-teal-300/30 bg-teal-400/10 px-4 py-3.5 text-left"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-200/80">
              Recommended next
            </p>
            <p className="mt-0.5 text-sm font-black text-white">{next.title}</p>
            <p className="mt-0.5 text-[11px] text-emerald-100/55">
              {next.minutes} min · {next.steps.length} steps
            </p>
          </button>
        ) : null}

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onRepeat}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-teal-400 text-sm font-black text-teal-950"
          >
            <RotateCcw className="h-4 w-4" />
            Repeat workout
          </button>
          <button
            type="button"
            onClick={onAnother}
            className="h-12 w-full rounded-full border border-white/20 bg-white/10 text-sm font-bold"
          >
            Try another workout
          </button>
          <button
            type="button"
            onClick={onHome}
            className="h-12 w-full text-sm font-semibold text-emerald-100/60"
          >
            Return to Wellness
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <Icon className="h-4 w-4 text-teal-300" />
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/50">
        {label}
      </p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
