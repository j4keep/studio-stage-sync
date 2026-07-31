import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";
import { coachStillFor } from "@/lib/wellness-coach-stills";

type Props = {
  move: MoveIllustrationId;
  figure?: WellnessFigure;
  skinTone?: WellnessSkinTone;
  playing?: boolean;
  className?: string;
  /** Side-reach second half: show the opposite-side library card. */
  alternateSide?: boolean;
};

/**
 * Stretch-library slideshow: YAJ mascot card for the current coaching step.
 * No video / no automated motion — picture only. Voice is unchanged.
 */
export default function YajWellnessAvatar({
  move,
  className = "",
  alternateSide = false,
}: Props) {
  const src = coachStillFor(move, { alternateSide });

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      aria-hidden
      role="img"
    >
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}
