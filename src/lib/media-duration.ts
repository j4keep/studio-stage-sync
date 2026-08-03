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

/**
 * Force WebM/MediaRecorder files to compute a finite duration by seeking near the end.
 * Returns a promise that resolves with the duration (or 0).
 */
export function resolveMediaDuration(el: HTMLMediaElement): Promise<number> {
  const existing = readMediaDuration(el);
  if (existing > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("loadedmetadata", onMeta);
      const d = readMediaDuration(el);
      try {
        if (el.currentTime > 0.25) el.currentTime = 0;
      } catch {
        /* ignore */
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
