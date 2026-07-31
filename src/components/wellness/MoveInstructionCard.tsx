import YajWellnessAvatar from "@/components/wellness/YajWellnessAvatar";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
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
};

/**
 * Exercise card: static coach slideshow still matched to the current step cue.
 * Voice / session runner is unchanged — only the picture swaps per maneuver.
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
}: Props) {
  // Side reach script says switch sides mid-hold — swap to the opposite still.
  const alternateSide =
    illustration === "side_reach" && holdLeft != null && holdLeft > 0 && holdLeft <= 5;

  return (
    <div className="relative mx-auto flex w-full max-w-[340px] flex-col overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white shadow-[0_20px_50px_-28px_rgba(15,80,70,0.45)]">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Step {stepNumber}/{totalSteps}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
          YAJ Coach
        </span>
      </div>
      <h2 className="px-4 text-center text-lg font-black tracking-tight text-stone-900">{title}</h2>

      <div className="relative mx-auto my-1 flex aspect-square w-[90%] max-w-[300px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#eef6f3] via-[#f5faf8] to-[#e8f2ef]">
        <YajWellnessAvatar
          move={illustration}
          figure={figure}
          skinTone={skinTone}
          alternateSide={alternateSide}
        />
        {holdLeft != null && holdLeft > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-teal-950/30 backdrop-blur-[1px]">
            <div className="text-center">
              <p className="text-6xl font-black tabular-nums text-white drop-shadow-lg">{holdLeft}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Hold</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 px-4 pb-4 pt-1">
        {caption ? (
          <p className="min-h-[2.5rem] text-center text-sm font-medium leading-snug text-stone-700">
            {caption}
          </p>
        ) : null}
        {breathCue ? (
          <p className="rounded-xl bg-sky-50 px-2.5 py-1.5 text-center text-[11px] font-semibold text-sky-800">
            Breath · {breathCue}
          </p>
        ) : null}
        {safetyTip ? (
          <p className="rounded-xl bg-amber-50 px-2.5 py-1.5 text-center text-[11px] font-semibold text-amber-900/80">
            Safety · {safetyTip}
          </p>
        ) : null}
      </div>
    </div>
  );
}
