import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";
import { coachStillFor } from "@/lib/wellness-coach-stills";

type Props = {
  move: MoveIllustrationId;
  figure?: WellnessFigure;
  skinTone?: WellnessSkinTone;
  playing?: boolean;
  className?: string;
  /** When true (e.g. side-reach second half), show the opposite-side still. */
  alternateSide?: boolean;
};

/**
 * Slideshow card art: one still of the Lovable coach per maneuver.
 * No automated video — picture swaps with each coaching step.
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
        className="h-full w-full object-contain"
      />
    </div>
  );
}
