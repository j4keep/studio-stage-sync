import { useEffect, useState } from "react";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

import stand from "@/assets/wellness/coach/yaj-coach-stand.webp";
import shouldersUp from "@/assets/wellness/coach/yaj-coach-shoulders-up.webp";
import neckLeft from "@/assets/wellness/coach/yaj-coach-neck-left.webp";
import neckRight from "@/assets/wellness/coach/yaj-coach-neck-right.webp";
import armsOverhead from "@/assets/wellness/coach/yaj-coach-arms-overhead.webp";
import forwardFold from "@/assets/wellness/coach/yaj-coach-forward-fold.webp";
import hipCircles from "@/assets/wellness/coach/yaj-coach-hip-circles.webp";
import walk from "@/assets/wellness/coach/yaj-coach-walk.webp";
import seatedMarch from "@/assets/wellness/coach/yaj-coach-seated-march.webp";
import seatedTwist from "@/assets/wellness/coach/yaj-coach-seated-twist.webp";
import sideStretch from "@/assets/wellness/coach/yaj-coach-side-stretch.webp";
import wallPushup from "@/assets/wellness/coach/yaj-coach-wall-pushup.webp";
import squat from "@/assets/wellness/coach/yaj-coach-squat.webp";
import chestOpener from "@/assets/wellness/coach/yaj-coach-chest-opener.webp";

type Props = {
  move: MoveIllustrationId;
  figure?: WellnessFigure;
  skinTone?: WellnessSkinTone;
  playing?: boolean;
  className?: string;
};

/**
 * Full-body YAJ Wellness Coach mascot frames.
 *
 * Motion = crossfade / swap between COMPLETE pose images.
 * Never CSS-rotates detached head/limb layers (that caused "decapitation").
 */
const POSE_FRAMES: Record<MoveIllustrationId, string[]> = {
  shoulders_roll: [stand, shouldersUp],
  neck_left: [stand, neckLeft],
  neck_right: [stand, neckRight],
  arms_overhead: [stand, armsOverhead],
  forward_fold: [stand, forwardFold],
  hip_circles: [stand, hipCircles],
  stand_tall: [stand],
  walk: [stand, walk],
  arm_swing: [stand, walk],
  brisk_walk: [walk, stand],
  cool_down: [walk, stand],
  seated_march: [seatedMarch, seatedTwist],
  seated_twist: [seatedMarch, seatedTwist],
  ankle_circles: [seatedMarch],
  side_reach: [stand, sideStretch],
  sit_to_stand: [seatedMarch, stand],
  march_place: [stand, walk],
  wall_pushup: [stand, wallPushup],
  squat: [stand, squat],
  side_steps: [stand, walk],
  cool_stretch: [stand, chestOpener, sideStretch],
};

export default function YajWellnessAvatar({
  move,
  playing = true,
  className = "",
}: Props) {
  const frames = POSE_FRAMES[move] ?? [stand];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!playing || frames.length < 2) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 1200);
    return () => window.clearInterval(id);
  }, [move, playing, frames.length]);

  const src = frames[Math.min(frame, frames.length - 1)] ?? stand;

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      aria-hidden
      role="img"
    >
      {frames.map((img, i) => (
        <img
          key={`${move}-${img}`}
          src={img}
          alt=""
          draggable={false}
          className={`absolute inset-0 m-auto h-[94%] w-auto max-w-full object-contain transition-opacity duration-700 ease-in-out ${
            i === frame ? "opacity-100" : "opacity-0"
          } ${playing && i === frame ? "yaj-coach-bob" : ""}`}
        />
      ))}
      {/* Keep current frame in flow for layout if absolute stack collapses */}
      <img src={src} alt="" className="invisible h-[94%] w-auto max-w-full object-contain" aria-hidden />
      <style>{`
        @keyframes yajCoachBob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.012); }
        }
        .yaj-coach-bob {
          animation: yajCoachBob 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yaj-coach-bob { animation: none; }
        }
      `}</style>
    </div>
  );
}
