import DemoFormGuide from "@/components/wellness/DemoFormGuide";
import type { DemoClip } from "@/lib/wellness-demos";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  demo?: DemoClip | null;
  /** Shown under the card — current step instruction */
  caption?: string;
  stepLabel?: string;
  className?: string;
  playing?: boolean;
  figure?: WellnessFigure;
  holdSeconds?: number;
};

/**
 * Instructional form guide card for Move / Relax.
 * Illustration cards + YAJ voice — no stock demo videos.
 */
export default function ExerciseDemoPlayer({
  demo,
  caption,
  stepLabel,
  className = "",
  playing = true,
  figure = "woman",
  holdSeconds,
}: Props) {
  if (!demo) {
    return (
      <div
        className={`relative mx-auto flex aspect-[9/16] max-h-[52vh] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-900/80 to-slate-900 ${className}`}
      >
        <p className="px-4 text-center text-sm text-white/60">Guide coming soon for this step</p>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-lg ${className}`}
    >
      <div className="relative aspect-[9/16] max-h-[52vh] w-full">
        <DemoFormGuide
          guide={demo.guide}
          setting={demo.setting}
          title={demo.title}
          playing={playing}
          figure={figure}
          holdSeconds={holdSeconds}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          {stepLabel ? (
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {stepLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-teal-500/95 px-2 py-1 text-[10px] font-black text-teal-950">
            Form guide
          </span>
        </div>
      </div>

      {caption ? (
        <div className="space-y-0.5 bg-[#0c1a17] px-3 py-2.5">
          <p className="text-sm font-semibold leading-snug text-white">{caption}</p>
          {holdSeconds && holdSeconds > 0 ? (
            <p className="text-[10px] text-teal-200/80">
              Hold ~{holdSeconds >= 60 ? `${Math.round(holdSeconds / 60)} min` : `${holdSeconds} sec`}
              {demo.credit ? ` · ${demo.credit}` : ""}
            </p>
          ) : demo.credit ? (
            <p className="text-[10px] text-white/45">{demo.credit}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
