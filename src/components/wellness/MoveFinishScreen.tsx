import { Check, Flame, Footprints, RotateCcw, Sparkles } from "lucide-react";
import type { CoachRoutine } from "@/lib/wellness-move-coach";

type Props = {
  routine: CoachRoutine;
  minutesDone: number;
  calories: number;
  streak: number;
  moodLabel?: string | null;
  onRepeat: () => void;
  onAnother: () => void;
  onHome: () => void;
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
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#0f1c18] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-emerald-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-400/20 text-3xl">
            🎉
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Nice work!</h1>
          <p className="mt-2 text-sm text-emerald-100/75">
            Today’s session complete — {routine.title}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat icon={Flame} label="Calories (est.)" value={`${calories}`} />
          <Stat icon={Footprints} label="Minutes moved" value={`${minutesDone}`} />
          <Stat icon={Check} label="Move streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
          <Stat
            icon={Sparkles}
            label="Mood check"
            value={moodLabel ? moodLabel : "Logged later"}
          />
        </div>

        <div className="mt-8 space-y-2.5">
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
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/50">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
