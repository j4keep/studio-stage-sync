import { useEffect, useRef } from "react";

interface Props {
  peaks?: Float32Array;
  width: number;
  height: number;
  color?: string;
}

export function WaveformView({ peaks, width, height, color = "rgba(255,255,255,0.85)" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !peaks) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    const mid = height / 2;
    const samples = peaks.length / 2;
    const step = samples / width;
    for (let x = 0; x < width; x++) {
      const i = Math.floor(x * step);
      const min = peaks[i * 2] ?? 0;
      const max = peaks[i * 2 + 1] ?? 0;
      const yTop = mid + min * mid;
      const yBot = mid + max * mid;
      ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
    }
  }, [peaks, width, height, color]);
  return <canvas ref={ref} width={width} height={height} className="block" />;
}
