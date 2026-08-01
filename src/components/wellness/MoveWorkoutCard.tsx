import { coachStillFor } from "@/lib/wellness-coach-stills";
import {
  levelLabel,
  levelStars,
  workoutCalories,
} from "@/lib/wellness-move-meta";
import type { CoachRoutine } from "@/lib/wellness-move-coach";
import { getWellnessFigure } from "@/lib/wellness";

type Props = {
  routine: CoachRoutine;
  onStart: () => void;
  compact?: boolean;
};

export default function MoveWorkoutCard({ routine, onStart, compact = false }: Props) {
  const figure = getWellnessFigure();
  const thumb = coachStillFor(routine.preview, { figure });
  const calories = workoutCalories(routine);
  const equipment = routine.equipment.filter((e) => e.toLowerCase() !== "none");

  if (compact) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="min-w-[9.5rem] snap-start overflow-hidden rounded-2xl border border-teal-900/10 bg-white text-left shadow-[0_12px_28px_-20px_rgba(15,80,70,0.45)]"
      >
        <div className="relative h-24 overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-100">
          <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
        </div>
        <div className="p-3">
          <p className="text-sm font-black leading-snug text-stone-900">{routine.title}</p>
          <p className="mt-1 text-[10px] font-semibold text-teal-700">
            {routine.minutes} min · ~{calories} cal
          </p>
        </div>
      </button>
    );
  }

  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-teal-900/10 bg-gradient-to-br from-white via-[#f7fbf9] to-[#eef6f3] shadow-[0_18px_40px_-28px_rgba(15,80,70,0.5)]">
      <div className="flex gap-3 p-4">
        <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-teal-50 to-emerald-100 ring-1 ring-teal-900/10">
          <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-teal-800">
            Preview
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              {levelStars(routine.level)} {levelLabel(routine.level)}
            </span>
            {equipment.length > 0 ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                {equipment.join(" · ")}
              </span>
            ) : (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                No equipment
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-stone-900">
            {routine.title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-stone-500">
            {routine.minutes} Minutes · {routine.steps.length} Guided Steps
          </p>
          <p className="mt-1 text-[11px] font-medium text-stone-500">
            {routine.targets.slice(0, 3).join(" · ")}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm font-semibold text-teal-800">Burns ~{calories} Calories</p>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Targets</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {routine.targets.map((t) => (
              <span
                key={t}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100"
              >
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] font-semibold text-stone-500">{routine.blurb}</p>
        <p className="text-[11px] font-bold text-teal-700">YAJ Voice Coach Included</p>
        <button
          type="button"
          onClick={onStart}
          className="move-start-btn group flex h-12 w-full items-center justify-center rounded-full bg-teal-600 text-sm font-black text-white shadow-[0_10px_24px_-12px_rgba(13,148,136,0.8)] transition active:scale-[0.99]"
        >
          Start →
        </button>
      </div>
      <style>{`
        .move-start-btn { animation: moveStartPulse 2.8s ease-in-out infinite; }
        @keyframes moveStartPulse {
          0%, 100% { box-shadow: 0 10px 24px -12px rgba(13,148,136,0.55); }
          50% { box-shadow: 0 14px 30px -10px rgba(13,148,136,0.85); }
        }
      `}</style>
    </article>
  );
}
