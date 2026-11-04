/** Minimum meaningful playback before one unique video view is recorded.
 * Two seconds for normal clips, half the duration of shorter clips.
 * Never count just opening the card or loading video metadata.
 */
export function hasMeaningfulPlayback(seconds: number, duration: number): boolean {
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  const threshold = Number.isFinite(duration) && duration > 0
    ? Math.min(2, Math.max(0.25, duration / 2))
    : 2;
  return seconds >= threshold;
}
