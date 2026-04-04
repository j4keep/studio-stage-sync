import { useEffect, useRef } from 'react';

type Props = {
  buffer: AudioBuffer;
  width: number;
  height: number;
  /** Wave line color (e.g. track color or white) */
  color: string;
  /** Region fill behind the wave */
  fill?: string;
  /** Optional window into the buffer (seconds). Defaults to full buffer. */
  viewStartSec?: number;
  viewEndSec?: number;
};

/**
 * Lightweight peak waveform (min/max per column) — reads channel 0.
 * Matches the “audiowave block” look in desktop DAWs.
 */
export function WaveformCanvas({
  buffer,
  width,
  height,
  color,
  fill = 'rgba(0,0,0,0.25)',
  viewStartSec = 0,
  viewEndSec,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || width < 1 || height < 1) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.floor(width * dpr));
    c.height = Math.max(1, Math.floor(height * dpr));
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const v0 = Math.max(0, viewStartSec);
    const v1 = Math.min(buffer.duration, viewEndSec ?? buffer.duration);
    const i0 = Math.max(0, Math.floor(v0 * sr));
    const i1 = Math.min(data.length, Math.max(i0 + 1, Math.ceil(v1 * sr)));
    const span = i1 - i0;

    const mid = height / 2;
    const amp = mid * 0.92;
    const cols = Math.max(1, Math.floor(width));
    const step = Math.max(1, Math.floor(span / cols));

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = 0; x < cols; x++) {
      let min = 0;
      let max = 0;
      const start = i0 + x * step;
      const end = Math.min(start + step, i1);
      for (let i = start; i < end; i++) {
        const s = data[i]!;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      ctx.moveTo(x + 0.5, mid - max * amp);
      ctx.lineTo(x + 0.5, mid - min * amp);
    }
    ctx.stroke();
  }, [buffer, width, height, color, fill, viewStartSec, viewEndSec]);

  return <canvas ref={ref} className="pointer-events-none block" aria-hidden />;
}
