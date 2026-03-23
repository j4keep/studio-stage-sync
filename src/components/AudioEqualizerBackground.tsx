import { useRef, useEffect } from "react";

interface AudioEqualizerBackgroundProps {
  mediaElement: HTMLMediaElement | null;
  isPlaying: boolean;
}

const BAR_COUNT = 48;

const AudioEqualizerBackground = ({ mediaElement, isPlaying }: AudioEqualizerBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener("resize", resize);

    let phase = 0;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      c.clearRect(0, 0, w, h);

      const barData: number[] = [];

      if (isPlaying) {
        phase += 0.06;
        for (let i = 0; i < BAR_COUNT; i++) {
          const base = 0.15 + Math.sin(phase + i * 0.35) * 0.12;
          const wave = Math.sin(phase * 1.7 + i * 0.5) * 0.15;
          const pulse = Math.sin(phase * 0.8) * 0.08;
          barData.push(Math.min(1, Math.max(0.05, base + wave + pulse + Math.random() * 0.1)));
        }
      } else {
        phase += 0.01;
        for (let i = 0; i < BAR_COUNT; i++) {
          barData.push(0.08 + Math.sin(phase + i * 0.25) * 0.06);
        }
      }

      const barW = w / BAR_COUNT;
      const maxH = h * 0.7;

      for (let i = 0; i < BAR_COUNT; i++) {
        const barH = barData[i] * maxH;
        const x = i * barW;
        const y = h - barH;

        const grad = c.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, `hsla(220, 100%, 35%, ${0.4 + barData[i] * 0.5})`);
        grad.addColorStop(1, `hsla(220, 100%, 35%, 0.08)`);

        c.fillStyle = grad;
        c.fillRect(x + 1, y, barW - 2, barH);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-50"
      style={{ mixBlendMode: "screen" }}
    />
  );
};

export default AudioEqualizerBackground;
