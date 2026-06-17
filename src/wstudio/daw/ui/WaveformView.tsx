import { useEffect, useRef } from "react";

interface Props {
  peaks?: Float32Array;
  width: number;
  height: number;
  color?: string;
  /** When provided, render only the slice [offsetRatio, offsetRatio + spanRatio] of the peaks. */
  offsetRatio?: number;
  spanRatio?: number;
}

export function WaveformView({ peaks, width, height, color = "rgba(255,255,255,0.85)", offsetRatio = 0, spanRatio = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !peaks) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    const mid = height / 2;
    const totalSamples = peaks.length / 2;
    const startSample = Math.max(0, Math.floor(offsetRatio * totalSamples));
    const endSample = Math.min(totalSamples, Math.ceil((offsetRatio + spanRatio) * totalSamples));
    const visible = Math.max(1, endSample - startSample);
    const step = visible / width;
    for (let x = 0; x < width; x++) {
      const i = Math.min(totalSamples - 1, startSample + Math.floor(x * step));
      const min = peaks[i * 2] ?? 0;
      const max = peaks[i * 2 + 1] ?? 0;
      const yTop = mid + min * mid;
      const yBot = mid + max * mid;
      ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
    }
  }, [peaks, width, height, color, offsetRatio, spanRatio]);
  return <canvas ref={ref} width={width} height={height} className="block" />;
}
