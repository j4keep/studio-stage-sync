import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

import stand from "@/assets/wellness/coach/yaj-coach-stand.webp";
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
  /** Optional short demo clip (mp4/webm). When set, plays instead of the still. */
  videoSrc?: string | null;
};

/**
 * One clear form image per move (no multi-frame “dancing”).
 * Pass `videoSrc` when you have a real Gemini/demo clip for that move.
 */
const POSE_STILL: Record<MoveIllustrationId, string> = {
  // Calm “roll shoulders back / open chest” cue — not a looping dance
  shoulders_roll: shouldersBack,
  neck_left: neckLeft,
  neck_right: neckRight,
  arms_overhead: armsOverhead,
  forward_fold: forwardFold,
  hip_circles: hipCircles,
  stand_tall: stand,
  walk: walk,
  arm_swing: walk,
  brisk_walk: walk,
  cool_down: stand,
  seated_march: seatedMarch,
  seated_twist: seatedTwist,
  ankle_circles: seatedMarch,
  side_reach: sideStretch,
  sit_to_stand: stand,
  march_place: walk,
  wall_pushup: wallPushup,
  squat: squat,
  side_steps: walk,
  cool_stretch: chestOpener,
};

export default function YajWellnessAvatar({
  move,
  playing = true,
  className = "",
  videoSrc = null,
}: Props) {
  const still = POSE_STILL[move] ?? stand;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, videoSrc]);

  if (videoSrc) {
    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
        aria-hidden
      >
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className="h-[94%] w-auto max-w-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={still}
        />
      </div>
    );
  }


  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      aria-hidden
      role="img"
    >
      <img
        src={still}
        alt=""
        draggable={false}
        className={`h-[94%] w-auto max-w-full object-contain ${playing ? "yaj-coach-bob" : ""}`}
      />
      <style>{`
        @keyframes yajCoachBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .yaj-coach-bob {
          animation: yajCoachBob 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yaj-coach-bob { animation: none; }
        }
      `}</style>
    </div>
  );
}
