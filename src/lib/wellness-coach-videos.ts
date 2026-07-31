/**
 * Video clips are retired in favor of the coach still slideshow
 * (`wellness-coach-stills.ts`). These stubs keep any leftover imports compiling.
 */
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";

export type CoachVideoClip = {
  url: string;
  mirror: boolean;
};

export const COACH_VIDEOS: Partial<Record<MoveIllustrationId, string>> = {};

export function coachVideoFor(_move: MoveIllustrationId): string | null {
  return null;
}

export function coachVideoClipFor(_move: MoveIllustrationId): CoachVideoClip | null {
  return null;
}
