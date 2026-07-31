import { useEffect, useState } from "react";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";
import { coachStillFor } from "@/lib/wellness-coach-stills";
import { tintCoachStill } from "@/lib/wellness-coach-skin";

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
 * Stretch / coach slideshow: mascot matches profile figure + skin tone.
 * Woman → 3D coach stills; man → YAJ stretch-library cards.
 * No video — picture only. Voice is unchanged.
 */
export default function YajWellnessAvatar({
  move,
  figure = "woman",
  skinTone = "medium",
  className = "",
  alternateSide = false,
}: Props) {
  const baseSrc = coachStillFor(move, { alternateSide, figure });
  const [src, setSrc] = useState(baseSrc);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(baseSrc);

    void (async () => {
      try {
        const tinted = await tintCoachStill(baseSrc, skinTone);
        if (cancelled) {
          URL.revokeObjectURL(tinted);
          return;
        }
        objectUrl = tinted;
        setSrc(tinted);
      } catch {
        if (!cancelled) setSrc(baseSrc);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [baseSrc, skinTone]);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      aria-hidden
      role="img"
      data-figure={figure}
      data-skin={skinTone}
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
