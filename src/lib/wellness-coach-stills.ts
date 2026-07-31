import type { MoveIllustrationId } from "@/lib/wellness-move-coach";

import shouldersRoll from "@/assets/wellness/stretch-cards/shoulders_roll.webp";
import neckLeft from "@/assets/wellness/stretch-cards/neck_left.webp";
import neckRight from "@/assets/wellness/stretch-cards/neck_right.webp";
import armsOverhead from "@/assets/wellness/stretch-cards/arms_overhead.webp";
import forwardFold from "@/assets/wellness/stretch-cards/forward_fold.webp";
import hipCircles from "@/assets/wellness/stretch-cards/hip_circles.webp";
import standTall from "@/assets/wellness/stretch-cards/stand_tall.webp";
import walk from "@/assets/wellness/stretch-cards/walk.webp";
import armSwing from "@/assets/wellness/stretch-cards/arm_swing.webp";
import briskWalk from "@/assets/wellness/stretch-cards/brisk_walk.webp";
import coolDown from "@/assets/wellness/stretch-cards/cool_down.webp";
import seatedMarch from "@/assets/wellness/stretch-cards/seated_march.webp";
import seatedTwist from "@/assets/wellness/stretch-cards/seated_twist.webp";
import ankleCircles from "@/assets/wellness/stretch-cards/ankle_circles.webp";
import sideReach from "@/assets/wellness/stretch-cards/side_reach.webp";
import sideReachAlt from "@/assets/wellness/stretch-cards/side_reach_alt.webp";
import sitToStand from "@/assets/wellness/stretch-cards/sit_to_stand.webp";
import marchPlace from "@/assets/wellness/stretch-cards/march_place.webp";
import wallPushup from "@/assets/wellness/stretch-cards/wall_pushup.webp";
import squat from "@/assets/wellness/stretch-cards/squat.webp";
import sideSteps from "@/assets/wellness/stretch-cards/side_steps.webp";
import coolStretch from "@/assets/wellness/stretch-cards/cool_stretch.webp";

/**
 * YAJ Wellness Coach stretch-library cards (slideshow).
 * One card per maneuver, matched to the spoken coaching step.
 * Voice / session runner is unchanged — only the picture swaps.
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
