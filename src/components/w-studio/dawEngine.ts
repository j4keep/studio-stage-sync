import type { Clip } from './types';
import { clipTrimEnd, clipTrimStart } from './types';

/**
 * Multitrack clip scheduling helpers.
 * `dest` must be the **EQ input** (first band): signal chain is
 * clip gain → EQ → comp → reverb → pan → fader → master.
 */
export class DAWEngine {
  /**
   * Schedules one trimmed region from `clip.buffer` into `dest` (track EQ in).
   * Returns the `AudioBufferSourceNode` for transport stop(), or null if inaudible at `p0`.
   */
  static scheduleClipIfAudible(
    ctx: BaseAudioContext,
    clip: Clip,
    dest: AudioNode,
    t0: number,
    p0: number,
  ): AudioBufferSourceNode | null {
    const trimS = clipTrimStart(clip);
    const trimE = clipTrimEnd(clip);
    const visDur = Math.max(0.001, trimE - trimS);
    const clipEnd = clip.startTime + visDur;
    if (clipEnd <= p0) return null;

    const playFrom = Math.max(p0, clip.startTime);
    const offsetInBuffer = trimS + (playFrom - clip.startTime);
    const duration = clipEnd - playFrom;
    const when = t0 + (playFrom - p0);

    const src = ctx.createBufferSource();
    src.buffer = clip.buffer;
    const cg = ctx.createGain();
    cg.gain.value = Math.max(0, clip.clipGain ?? 1);
    src.connect(cg);
    cg.connect(dest);
    src.start(when, offsetInBuffer, duration);
    return src;
  }
}
