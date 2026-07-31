import type { MoveIllustrationId } from "@/lib/wellness-move-coach";

import shouldersRoll from "@/assets/wellness/coach-stills/shoulders_roll.webp";
import neckLeft from "@/assets/wellness/coach-stills/neck_left.webp";
import neckRight from "@/assets/wellness/coach-stills/neck_right.webp";
import armsOverhead from "@/assets/wellness/coach-stills/arms_overhead.webp";
import forwardFold from "@/assets/wellness/coach-stills/forward_fold.webp";
import hipCircles from "@/assets/wellness/coach-stills/hip_circles.webp";
import standTall from "@/assets/wellness/coach-stills/stand_tall.webp";
import walk from "@/assets/wellness/coach-stills/walk.webp";
import armSwing from "@/assets/wellness/coach-stills/arm_swing.webp";
import briskWalk from "@/assets/wellness/coach-stills/brisk_walk.webp";
import coolDown from "@/assets/wellness/coach-stills/cool_down.webp";
import seatedMarch from "@/assets/wellness/coach-stills/seated_march.webp";
import seatedTwist from "@/assets/wellness/coach-stills/seated_twist.webp";
import ankleCircles from "@/assets/wellness/coach-stills/ankle_circles.webp";
import sideReach from "@/assets/wellness/coach-stills/side_reach.webp";
import sideReachAlt from "@/assets/wellness/coach-stills/side_reach_alt.webp";
import sitToStand from "@/assets/wellness/coach-stills/sit_to_stand.webp";
import marchPlace from "@/assets/wellness/coach-stills/march_place.webp";
import wallPushup from "@/assets/wellness/coach-stills/wall_pushup.webp";
import squat from "@/assets/wellness/coach-stills/squat.webp";
import sideSteps from "@/assets/wellness/coach-stills/side_steps.webp";
import coolStretch from "@/assets/wellness/coach-stills/cool_stretch.webp";

/**
 * Slideshow stills — same Lovable coach illustrator, one clear pose per move.
 * No looping video. Card swaps the picture when the coach advances a step.
 *
 * neck_right was baked mirrored (source clip only tilted left).
 * side_reach_alt is the mirrored opposite side for “switch sides”.
 */
const COACH_STILLS: Record<MoveIllustrationId, string> = {
  shoulders_roll: shouldersRoll,
  neck_left: neckLeft,
  neck_right: neckRight,
  arms_overhead: armsOverhead,
  forward_fold: forwardFold,
  hip_circles: hipCircles,
  stand_tall: standTall,
  walk: walk,
  arm_swing: armSwing,
  brisk_walk: briskWalk,
  cool_down: coolDown,
  seated_march: seatedMarch,
  seated_twist: seatedTwist,
  ankle_circles: ankleCircles,
  side_reach: sideReach,
  sit_to_stand: sitToStand,
  march_place: marchPlace,
  wall_pushup: wallPushup,
  squat: squat,
  side_steps: sideSteps,
  cool_stretch: coolStretch,
};

export function coachStillFor(
  move: MoveIllustrationId,
  opts?: { alternateSide?: boolean },
): string {
  if (move === "side_reach" && opts?.alternateSide) return sideReachAlt;
  return COACH_STILLS[move] ?? standTall;
}
