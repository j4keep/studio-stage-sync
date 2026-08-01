import YajWellnessAvatar from "@/components/wellness/YajWellnessAvatar";
import type { MoveIllustrationId, MuscleTarget } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

type Props = {
  illustration: MoveIllustrationId;
  title: string;
  stepNumber: number;
  totalSteps: number;
  figure?: WellnessFigure;
  skinTone?: WellnessSkinTone;
  holdLeft?: number | null;
  caption?: string;
  breathCue?: string;
  safetyTip?: string;
  animating?: boolean;
  difficultyLabel?: string;
  targets?: MuscleTarget[];
  holdSeconds?: number;
};

/**
 * Exercise card: static coach slideshow still matched to the current step cue.
 * Voice / session runner is unchanged — only the picture swaps per maneuver.
 * Chrome around the mascot is premium; the illustration itself is untouched.
 */
export default function MoveInstructionCard({
  illustration,
  title,
  stepNumber,
  totalSteps,
  figure = "woman",
  skinTone = "medium",
  holdLeft = null,
  caption,
  breathCue,
  safetyTip,
  difficultyLabel,
  targets = [],
  holdSeconds,
}: Props) {
  // Side reach script says switch sides mid-hold — swap to the opposite still.
  const alternateSide =
    illustration === "side_reach" && holdLeft != null && holdLeft > 0 && holdLeft <= 5;

  const tip = safetyTip || breathCue;

  return (
    <div className="relative mx-auto flex w-full max-w-[340px] flex-col overflow-hidden rounded-[1.75rem] border border-teal-900/10 bg-gradient-to-b from-white via-[#f8fbfa] to-[#eef6f3] shadow-[0_22px_50px_-28px_rgba(15,80,70,0.5)]">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Step {stepNumber}/{totalSteps}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {difficultyLabel ? (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              {difficultyLabel}
            </span>
          ) : null}
          {holdSeconds ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              ~{holdSeconds}s hold
            </span>
          ) : null}
        </div>
      </div>
      <p className="px-4 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
        YAJ Coach
      </p>
      <h2 className="px-4 text-center font-display text-xl font-bold tracking-tight text-stone-900">
        {title}
      </h2>

      <div className="relative mx-auto my-1.5 flex aspect-square w-[90%] max-w-[300px] items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-b from-[#eef6f3] via-[#f5faf8] to-[#e8f2ef] ring-1 ring-teal-900/10">
        <YajWellnessAvatar
          move={illustration}
          figure={figure}
          skinTone={skinTone}
          alternateSide={alternateSide}
        />
        {holdLeft != null && holdLeft > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[1.35rem] bg-teal-950/30 backdrop-blur-[1px]">
            <div className="text-center">
              <p className="text-6xl font-black tabular-nums text-white drop-shadow-lg">{holdLeft}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Hold</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 px-4 pb-4 pt-1">
        {caption ? (
          <p className="min-h-[2.5rem] text-center text-sm font-medium leading-snug text-stone-700">
            {caption}
          </p>
        ) : null}

        {tip ? (
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/60 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-800/80">
              💡 Coach Tip
            </p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-amber-950/85">{tip}</p>
          </div>
        ) : null}

        {targets.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Targets</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {targets.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {breathCue && safetyTip ? (
          <p className="rounded-xl bg-sky-50 px-2.5 py-1.5 text-center text-[11px] font-semibold text-sky-800">
            Breath · {breathCue}
          </p>
        ) : null}
      </div>
    </div>
  );
}
