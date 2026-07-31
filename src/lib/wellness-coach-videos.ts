import type { MoveIllustrationId } from "@/lib/wellness-move-coach";

import shouldersRoll from "@/assets/wellness/coach-videos/shoulders_roll.mp4.asset.json";
import neckLeft from "@/assets/wellness/coach-videos/neck_left.mp4.asset.json";
import neckRight from "@/assets/wellness/coach-videos/neck_right.mp4.asset.json";
import armsOverhead from "@/assets/wellness/coach-videos/arms_overhead.mp4.asset.json";
import forwardFold from "@/assets/wellness/coach-videos/forward_fold.mp4.asset.json";
import hipCircles from "@/assets/wellness/coach-videos/hip_circles.mp4.asset.json";
import standTall from "@/assets/wellness/coach-videos/stand_tall.mp4.asset.json";
import walk from "@/assets/wellness/coach-videos/walk.mp4.asset.json";
import armSwing from "@/assets/wellness/coach-videos/arm_swing.mp4.asset.json";
import briskWalk from "@/assets/wellness/coach-videos/brisk_walk.mp4.asset.json";
import coolDown from "@/assets/wellness/coach-videos/cool_down.mp4.asset.json";
import seatedMarch from "@/assets/wellness/coach-videos/seated_march.mp4.asset.json";
import seatedTwist from "@/assets/wellness/coach-videos/seated_twist.mp4.asset.json";
import ankleCircles from "@/assets/wellness/coach-videos/ankle_circles.mp4.asset.json";
import sideReach from "@/assets/wellness/coach-videos/side_reach.mp4.asset.json";
import sitToStand from "@/assets/wellness/coach-videos/sit_to_stand.mp4.asset.json";
import marchPlace from "@/assets/wellness/coach-videos/march_place.mp4.asset.json";
import wallPushup from "@/assets/wellness/coach-videos/wall_pushup.mp4.asset.json";
import squat from "@/assets/wellness/coach-videos/squat.mp4.asset.json";
import sideSteps from "@/assets/wellness/coach-videos/side_steps.mp4.asset.json";
import coolStretch from "@/assets/wellness/coach-videos/cool_stretch.mp4.asset.json";

/**
 * Animated coach demo clip per Move illustration.
 * Each clip loops silently while YAJ's voice coaches that step.
 */
const COACH_VIDEO_URLS: Partial<Record<MoveIllustrationId, string>> = {
  shoulders_roll: shouldersRoll.url,
  neck_left: neckLeft.url,
  neck_right: neckRight.url,
  arms_overhead: armsOverhead.url,
  forward_fold: forwardFold.url,
  hip_circles: hipCircles.url,
  stand_tall: standTall.url,
  walk: walk.url,
  arm_swing: armSwing.url,
  brisk_walk: briskWalk.url,
  cool_down: coolDown.url,
  seated_march: seatedMarch.url,
  seated_twist: seatedTwist.url,
  ankle_circles: ankleCircles.url,
  side_reach: sideReach.url,
  sit_to_stand: sitToStand.url,
  march_place: marchPlace.url,
  wall_pushup: wallPushup.url,
  squat: squat.url,
  side_steps: sideSteps.url,
  cool_stretch: coolStretch.url,
};

/**
 * Clips that were authored tilting/leaning the wrong way for their label.
 * We keep Lovable's assets and flip playback so voice + motion match.
 *
 * Verified: both neck_left.mp4 and neck_right.mp4 tilt toward the
 * character's LEFT — so neck_right must be mirrored to show a right tilt.
 */
const MIRROR_MOVES = new Set<MoveIllustrationId>(["neck_right"]);

export type CoachVideoClip = {
  url: string;
  /** CSS horizontal flip — does not rewrite the illustrator asset. */
  mirror: boolean;
};

/** @deprecated Prefer coachVideoClipFor — kept for any old imports. */
export const COACH_VIDEOS: Partial<Record<MoveIllustrationId, string>> = COACH_VIDEO_URLS;

export function coachVideoClipFor(move: MoveIllustrationId): CoachVideoClip | null {
  const url = COACH_VIDEO_URLS[move];
  if (!url) return null;
  return { url, mirror: MIRROR_MOVES.has(move) };
}

export function coachVideoFor(move: MoveIllustrationId): string | null {
  return COACH_VIDEO_URLS[move] ?? null;
}
