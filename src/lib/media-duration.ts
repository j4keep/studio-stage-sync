/** Resolve media duration when browsers report Infinity (common for MediaRecorder WebM). */
export function readMediaDuration(el: HTMLMediaElement | null | undefined): number {
  if (!el) return 0;
  const d = el.duration;
  if (Number.isFinite(d) && d > 0) return d;
  try {
    if (el.seekable && el.seekable.length > 0) {
      const end = el.seekable.end(el.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

type ResolveOpts = {
  /**
   * Force the Infinity→finite probe even while playing.
   * Default false: never seek an actively playing element (causes feed glitches).
   */
  force?: boolean;
};

/**
 * Force WebM/MediaRecorder files to compute a finite duration by seeking near the end.
 * Preserves playback position and will not interrupt an in-progress play unless `force`.
 */
export function resolveMediaDuration(
  el: HTMLMediaElement,
  opts: ResolveOpts = {},
): Promise<number> {
  const existing = readMediaDuration(el);
  if (existing > 0) return Promise.resolve(existing);

  // Playing with unknown duration — don't yank the playhead; caller can retry later.
  if (!opts.force && !el.paused && (el.currentTime || 0) > 0.05) {
    return Promise.resolve(0);
  }

  const savedTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
  const wasPlaying = !el.paused;

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("loadedmetadata", onMeta);
      const d = readMediaDuration(el);
      try {
        if (Math.abs((el.currentTime || 0) - savedTime) > 0.05) {
          el.currentTime = savedTime;
        }
      } catch {
        /* ignore */
      }
      if (wasPlaying) {
        void el.play().catch(() => undefined);
      }
      resolve(d);
    };
    const onSeeked = () => finish();
    const onMeta = () => {
      if (readMediaDuration(el) > 0) finish();
    };
    el.addEventListener("seeked", onSeeked);
    el.addEventListener("loadedmetadata", onMeta);
    try {
      el.currentTime = 1e101;
    } catch {
      finish();
      return;
    }
    window.setTimeout(finish, 1500);
  });
}
