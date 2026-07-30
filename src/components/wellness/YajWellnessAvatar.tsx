import { useEffect, useState } from "react";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

import stand from "@/assets/wellness/coach/yaj-coach-stand.webp";
import shouldersForward from "@/assets/wellness/coach/yaj-coach-shoulders-forward.webp";
import shouldersUp from "@/assets/wellness/coach/yaj-coach-shoulders-up.webp";
import shouldersBack from "@/assets/wellness/coach/yaj-coach-shoulders-back.webp";
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

type PoseClip = {
  frames: string[];
  /** ms between frames while playing */
  intervalMs: number;
};

/**
 * Full-body YAJ Wellness Coach mascot frames.
 *
 * Motion = crossfade between COMPLETE pose images (never CSS limb detach).
 * Shoulders roll uses a 3-frame forward → up → back cycle so arms clearly move.
 */
const POSE_CLIPS: Record<MoveIllustrationId, PoseClip> = {
  shoulders_roll: {
    frames: [shouldersForward, shouldersUp, shouldersBack],
    intervalMs: 700,
  },
  neck_left: { frames: [neckLeft], intervalMs: 1400 },
  neck_right: { frames: [neckRight], intervalMs: 1400 },
  arms_overhead: { frames: [armsOverhead], intervalMs: 1400 },
  forward_fold: { frames: [forwardFold], intervalMs: 1400 },
  hip_circles: { frames: [hipCircles], intervalMs: 1400 },
  stand_tall: { frames: [stand], intervalMs: 1400 },
  walk: { frames: [walk], intervalMs: 1400 },
  arm_swing: { frames: [walk], intervalMs: 1400 },
  brisk_walk: { frames: [walk], intervalMs: 1400 },
  cool_down: { frames: [walk, stand], intervalMs: 1400 },
  seated_march: { frames: [seatedMarch], intervalMs: 1400 },
  seated_twist: { frames: [seatedTwist], intervalMs: 1400 },
  ankle_circles: { frames: [seatedMarch], intervalMs: 1400 },
  side_reach: { frames: [sideStretch], intervalMs: 1400 },
  sit_to_stand: { frames: [seatedMarch, stand], intervalMs: 1200 },
  march_place: { frames: [walk], intervalMs: 1400 },
  wall_pushup: { frames: [wallPushup], intervalMs: 1400 },
  squat: { frames: [squat], intervalMs: 1400 },
  side_steps: { frames: [walk], intervalMs: 1400 },
  cool_stretch: { frames: [chestOpener, sideStretch], intervalMs: 1400 },
};

export default function YajWellnessAvatar({
  move,
  playing = true,
  className = "",
}: Props) {
  const clip = POSE_CLIPS[move] ?? { frames: [stand], intervalMs: 1400 };
  const frames = clip.frames;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!playing || frames.length < 2) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, clip.intervalMs);
    return () => window.clearInterval(id);
  }, [move, playing, frames.length, clip.intervalMs]);

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
          className={`absolute inset-0 m-auto h-[94%] w-auto max-w-full object-contain transition-opacity duration-500 ease-in-out ${
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
