import DemoFormGuide from "@/components/wellness/DemoFormGuide";
import type { DemoClip } from "@/lib/wellness-demos";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  demo?: DemoClip | null;
  /** Shown under the card — current step instruction */
  caption?: string;
  stepLabel?: string;
  className?: string;
  /** Kept for API compat — cards are always static pictures. */
  playing?: boolean;
  figure?: WellnessFigure;
  holdSeconds?: number;
};

/**
 * Static instructional form cards for Move / Relax.
 * Stock-diagram style panels — not auto-animated video/silhouettes.
 */
export default function ExerciseDemoPlayer({
  demo,
  caption,
  stepLabel,
  className = "",
  figure = "woman",
  holdSeconds,
}: Props) {
  if (!demo) {
    return (
      <div
        className={`relative mx-auto flex aspect-[3/4] max-h-[56vh] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-[#f7faf8] ${className}`}
      >
        <p className="px-4 text-center text-sm text-stone-500">Guide coming soon for this step</p>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg ${className}`}
    >
      <div className="relative aspect-[3/4] max-h-[56vh] w-full">
        <DemoFormGuide
          guide={demo.guide}
          setting={demo.setting}
          title={demo.title}
          figure={figure}
          holdSeconds={holdSeconds}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
          {stepLabel ? (
            <span className="rounded-full bg-stone-900/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              {stepLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-sky-500 px-2 py-1 text-[10px] font-black text-white">
            How to
          </span>
        </div>
      </div>

      {caption ? (
        <div className="space-y-0.5 border-t border-stone-100 bg-white px-3 py-2.5">
          <p className="text-sm font-semibold leading-snug text-stone-900">{caption}</p>
          {holdSeconds && holdSeconds > 0 ? (
            <p className="text-[10px] font-semibold text-sky-600">
              Hold about {holdSeconds >= 60 ? `${Math.round(holdSeconds / 60)} min` : `${holdSeconds} sec`}
              {" · "}
              {figure === "man" ? "Men’s guide" : "Women’s guide"}
            </p>
          ) : (
            <p className="text-[10px] text-stone-500">
              {figure === "man" ? "Men’s form guide" : "Women’s form guide"} · YAJ will coach out loud
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
