import { useEffect, useRef } from "react";

interface Props {
  analysers: AnalyserNode[]; // 1 = mono, 2 = stereo (L,R)
  height?: number;
  className?: string;
}

/** Logic-style horizontal level meter. Renders 1 or 2 stacked bars over a transparent canvas. */
export function HorizontalMeter({ analysers, height = 10, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const peakHoldRef = useRef<number[]>([0, 0]);

  useEffect(() => {
    if (!analysers.length) return;
    const buffers = analysers.map(a => new Float32Array(a.fftSize));
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      if (!c) { raf = requestAnimationFrame(draw); return; }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      const rows = analysers.length;
      const rowH = Math.max(2, Math.floor((H - (rows - 1)) / rows));
      for (let i = 0; i < rows; i++) {
        analysers[i].getFloatTimeDomainData(buffers[i]);
        let peak = 0;
        for (let j = 0; j < buffers[i].length; j++) {
          const v = Math.abs(buffers[i][j]);
          if (v > peak) peak = v;
        }
        const db = 20 * Math.log10(peak + 1e-9);
        const n = Math.max(0, Math.min(1, (db + 48) / 48));
        // peak hold decay
        peakHoldRef.current[i] = Math.max(n, (peakHoldRef.current[i] ?? 0) - 0.01);
        const y = i * (rowH + 1);
        // background
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, y, W, rowH);
        // gradient fill
        const fillW = n * W;
        const grd = ctx.createLinearGradient(0, 0, W, 0);
        grd.addColorStop(0, "#16a34a");
        grd.addColorStop(0.7, "#22c55e");
        grd.addColorStop(0.85, "#eab308");
        grd.addColorStop(1, "#ef4444");
        ctx.fillStyle = grd;
        ctx.fillRect(0, y, fillW, rowH);
        // peak hold tick
        const px = Math.floor(peakHoldRef.current[i] * (W - 1));
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(px, y, 1, rowH);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analysers]);

  return <canvas ref={ref} width={300} height={height} className={`w-full ${className}`} style={{ height, display: "block" }} />;
}
