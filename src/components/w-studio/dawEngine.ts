import type { Clip } from './types';
import { clipTrimEnd, clipTrimStart } from './types';

/**
 * Multitrack clip scheduling helpers. UI and track FX stay outside;
 * this only computes Web Audio start time / offset / duration and wires clip gain.
 */
export class DAWEngine {
  /**
   * Schedules one trimmed region from `clip.buffer` into `dest` (e.g. track fader).
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
