import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure } from "@/lib/wellness";

/* Man — YAJ stretch-library cards */
import manShouldersRoll from "@/assets/wellness/stretch-cards/shoulders_roll.webp";
import manNeckLeft from "@/assets/wellness/stretch-cards/neck_left.webp";
import manNeckRight from "@/assets/wellness/stretch-cards/neck_right.webp";
import manArmsOverhead from "@/assets/wellness/stretch-cards/arms_overhead.webp";
import manForwardFold from "@/assets/wellness/stretch-cards/forward_fold.webp";
import manHipCircles from "@/assets/wellness/stretch-cards/hip_circles.webp";
import manStandTall from "@/assets/wellness/stretch-cards/stand_tall.webp";
import manWalk from "@/assets/wellness/stretch-cards/walk.webp";
import manArmSwing from "@/assets/wellness/stretch-cards/arm_swing.webp";
import manBriskWalk from "@/assets/wellness/stretch-cards/brisk_walk.webp";
import manCoolDown from "@/assets/wellness/stretch-cards/cool_down.webp";
import manSeatedMarch from "@/assets/wellness/stretch-cards/seated_march.webp";
import manSeatedTwist from "@/assets/wellness/stretch-cards/seated_twist.webp";
import manAnkleCircles from "@/assets/wellness/stretch-cards/ankle_circles.webp";
import manSideReach from "@/assets/wellness/stretch-cards/side_reach.webp";
import manSideReachAlt from "@/assets/wellness/stretch-cards/side_reach_alt.webp";
import manSitToStand from "@/assets/wellness/stretch-cards/sit_to_stand.webp";
import manMarchPlace from "@/assets/wellness/stretch-cards/march_place.webp";
import manWallPushup from "@/assets/wellness/stretch-cards/wall_pushup.webp";
import manSquat from "@/assets/wellness/stretch-cards/squat.webp";
import manSideSteps from "@/assets/wellness/stretch-cards/side_steps.webp";
import manCoolStretch from "@/assets/wellness/stretch-cards/cool_stretch.webp";

/* Woman — same moves, woman YAJ mascot cards */
import womanShouldersRoll from "@/assets/wellness/stretch-cards-woman/shoulders_roll.webp";
import womanNeckLeft from "@/assets/wellness/stretch-cards-woman/neck_left.webp";
import womanNeckRight from "@/assets/wellness/stretch-cards-woman/neck_right.webp";
import womanArmsOverhead from "@/assets/wellness/stretch-cards-woman/arms_overhead.webp";
import womanForwardFold from "@/assets/wellness/stretch-cards-woman/forward_fold.webp";
import womanHipCircles from "@/assets/wellness/stretch-cards-woman/hip_circles.webp";
import womanStandTall from "@/assets/wellness/stretch-cards-woman/stand_tall.webp";
import womanWalk from "@/assets/wellness/stretch-cards-woman/walk.webp";
import womanArmSwing from "@/assets/wellness/stretch-cards-woman/arm_swing.webp";
import womanBriskWalk from "@/assets/wellness/stretch-cards-woman/brisk_walk.webp";
import womanCoolDown from "@/assets/wellness/stretch-cards-woman/cool_down.webp";
import womanSeatedMarch from "@/assets/wellness/stretch-cards-woman/seated_march.webp";
import womanSeatedTwist from "@/assets/wellness/stretch-cards-woman/seated_twist.webp";
import womanAnkleCircles from "@/assets/wellness/stretch-cards-woman/ankle_circles.webp";
import womanSideReach from "@/assets/wellness/stretch-cards-woman/side_reach.webp";
import womanSideReachAlt from "@/assets/wellness/stretch-cards-woman/side_reach_alt.webp";
import womanSitToStand from "@/assets/wellness/stretch-cards-woman/sit_to_stand.webp";
import womanMarchPlace from "@/assets/wellness/stretch-cards-woman/march_place.webp";
import womanWallPushup from "@/assets/wellness/stretch-cards-woman/wall_pushup.webp";
import womanSquat from "@/assets/wellness/stretch-cards-woman/squat.webp";
import womanSideSteps from "@/assets/wellness/stretch-cards-woman/side_steps.webp";
import womanCoolStretch from "@/assets/wellness/stretch-cards-woman/cool_stretch.webp";

/**
 * Move coach slideshow — same MoveIllustrationId poses for woman and man.
 * Woman → stretch-cards-woman; man → stretch-cards. Skin tone remaps separately.
 */
const WOMAN_STILLS: Record<MoveIllustrationId, string> = {
  shoulders_roll: womanShouldersRoll,
  neck_left: womanNeckLeft,
  neck_right: womanNeckRight,
  arms_overhead: womanArmsOverhead,
  forward_fold: womanForwardFold,
  hip_circles: womanHipCircles,
  stand_tall: womanStandTall,
  walk: womanWalk,
  arm_swing: womanArmSwing,
  brisk_walk: womanBriskWalk,
  cool_down: womanCoolDown,
  seated_march: womanSeatedMarch,
  seated_twist: womanSeatedTwist,
  ankle_circles: womanAnkleCircles,
  side_reach: womanSideReach,
  sit_to_stand: womanSitToStand,
  march_place: womanMarchPlace,
  wall_pushup: womanWallPushup,
  squat: womanSquat,
  side_steps: womanSideSteps,
  cool_stretch: womanCoolStretch,
};

const MAN_STILLS: Record<MoveIllustrationId, string> = {
  shoulders_roll: manShouldersRoll,
  neck_left: manNeckLeft,
  neck_right: manNeckRight,
  arms_overhead: manArmsOverhead,
  forward_fold: manForwardFold,
  hip_circles: manHipCircles,
  stand_tall: manStandTall,
  walk: manWalk,
  arm_swing: manArmSwing,
  brisk_walk: manBriskWalk,
  cool_down: manCoolDown,
  seated_march: manSeatedMarch,
  seated_twist: manSeatedTwist,
  ankle_circles: manAnkleCircles,
  side_reach: manSideReach,
  sit_to_stand: manSitToStand,
  march_place: manMarchPlace,
  wall_pushup: manWallPushup,
  squat: manSquat,
  side_steps: manSideSteps,
  cool_stretch: manCoolStretch,
};

export function coachStillFor(
  move: MoveIllustrationId,
  opts?: { alternateSide?: boolean; figure?: WellnessFigure },
): string {
  const figure = opts?.figure === "man" ? "man" : "woman";
  const pack = figure === "man" ? MAN_STILLS : WOMAN_STILLS;
  if (move === "side_reach" && opts?.alternateSide) {
    return figure === "man" ? manSideReachAlt : womanSideReachAlt;
  }
  return pack[move] ?? (figure === "man" ? manStandTall : womanStandTall);
}
