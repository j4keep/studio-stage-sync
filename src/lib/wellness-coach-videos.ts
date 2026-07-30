import type { MoveIllustrationId } from "@/lib/wellness-move-coach";

/**
 * Optional short demo clips per Move illustration.
 *
 * Drop Gemini (or other) clips into `src/assets/wellness/coach-videos/` as
 * `.mp4` / `.webm`, import them here, and map by illustration id.
 *
 * Until a clip is wired, the card shows a calm still pose (no fake looping).
 *
 * Naming suggestion for the 5-minute stretch:
 * - shoulders_roll.mp4
 * - neck_left.mp4
 * - neck_right.mp4
 * - arms_overhead.mp4
 * - forward_fold.mp4
 */
export const COACH_VIDEOS: Partial<Record<MoveIllustrationId, string>> = {
  // Example once you upload:
  // shoulders_roll: shouldersRollVideo,
};

export function coachVideoFor(move: MoveIllustrationId): string | null {
  return COACH_VIDEOS[move] ?? null;
}
