import { useEffect, useRef } from "react";

interface Props {
  analyser: AnalyserNode | null;
  height?: number;
  width?: number;
}

export function Meter({ analyser, height = 160, width = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      const db = 20 * Math.log10(peak + 1e-9);
      const normalized = Math.max(0, Math.min(1, (db + 48) / 48));
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);
      const h = normalized * height;
      const grd = ctx.createLinearGradient(0, height, 0, 0);
      grd.addColorStop(0, "#22c55e");
      grd.addColorStop(0.7, "#eab308");
      grd.addColorStop(1, "#ef4444");
      ctx.fillStyle = grd;
      ctx.fillRect(0, height - h, width, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, height, width]);

  return <canvas ref={canvasRef} width={width} height={height} className="rounded-sm" />;
}
