import { useEffect, useState } from "react";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

import stand from "@/assets/wellness/coach/yaj-coach-stand.webp";
import shouldersRoll from "@/assets/wellness/coach/yaj-coach-shoulders-roll.webp";
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
 * Each move shows the EXERCISE pose as the primary frame (not idle hands-in-
 * pockets). Optional second frame crossfades for light motion — never CSS
 * limb rotation (that caused “decapitation”).
 */
const POSE_FRAMES: Record<MoveIllustrationId, string[]> = {
  // Roll: shrug ↔ roll (arms free — not in pockets)
  shoulders_roll: [shouldersUp, shouldersRoll],
  neck_left: [neckLeft],
  neck_right: [neckRight],
  arms_overhead: [armsOverhead],
  forward_fold: [forwardFold],
  hip_circles: [hipCircles],
  stand_tall: [stand],
  walk: [walk],
  arm_swing: [walk],
  brisk_walk: [walk],
  cool_down: [walk, stand],
  seated_march: [seatedMarch],
  seated_twist: [seatedTwist],
  ankle_circles: [seatedMarch],
  side_reach: [sideStretch],
  sit_to_stand: [seatedMarch, stand],
  march_place: [walk],
  wall_pushup: [wallPushup],
  squat: [squat],
  side_steps: [walk],
  cool_stretch: [chestOpener, sideStretch],
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
    }, 1400);
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
      <img src={src} alt="" className="invisible h-[94%] w-auto max-w-full object-contain" aria-hidden />
      <style>{`
        @keyframes yajCoachBob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.01); }
        }
        .yaj-coach-bob {
          animation: yajCoachBob 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yaj-coach-bob { animation: none; }
        }
      `}</style>
    </div>
  );
}
