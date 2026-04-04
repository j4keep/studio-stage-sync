import { useEffect, useRef } from "react";

type Props = {
  peaks: number[];
  width: number;
  height: number;
  color: string;
  fill?: string;
};

/** Renders a strip of bars from normalized peak samples (0–1) — used while recording. */
export function LivePeaksCanvas({ peaks, width, height, color, fill = "rgba(0,0,0,0.35)" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || width < 2 || height < 2) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.floor(width * dpr);
    c.height = Math.floor(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);

    const mid = height / 2;
    const n = peaks.length;
    if (n === 0) return;
    const barW = width / n;
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const p = Math.min(1, Math.max(0, peaks[i] ?? 0));
      const h = p * mid * 0.95;
      const x = i * barW;
      ctx.fillRect(x, mid - h, Math.max(1, barW - 0.5), h * 2);
    }
  }, [peaks, width, height, color, fill]);

  return <canvas ref={ref} className="pointer-events-none block h-full w-full" aria-hidden />;
}
