import { useRef, useEffect } from "react";

interface Props {
  isPlaying: boolean;
}

const SPEAKER_COUNT = 5;

const BattleSpeakersBackground = ({ isPlaying }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d")!;
    if (!c) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener("resize", resize);

    let phase = 0;

    const drawSpeaker = (cx: number, cy: number, size: number, pulse: number) => {
      // Outer ring
      c.beginPath();
      c.arc(cx, cy, size, 0, Math.PI * 2);
      c.fillStyle = "hsl(0 0% 8%)";
      c.fill();
      c.strokeStyle = "hsl(0 0% 18%)";
      c.lineWidth = 2;
      c.stroke();

      // Middle ring
      const midSize = size * 0.72;
      c.beginPath();
      c.arc(cx, cy, midSize, 0, Math.PI * 2);
      c.fillStyle = "hsl(0 0% 6%)";
      c.fill();
      c.strokeStyle = "hsl(0 0% 14%)";
      c.lineWidth = 1.5;
      c.stroke();

      // Cone ridges
      for (let r = 0; r < 3; r++) {
        const ridgeR = midSize * (0.85 - r * 0.2) + pulse * (3 - r);
        c.beginPath();
        c.arc(cx, cy, ridgeR, 0, Math.PI * 2);
        c.strokeStyle = `hsla(0, 0%, ${20 + r * 3}%, 0.4)`;
        c.lineWidth = 1;
        c.stroke();
      }

      // Inner cone (pulsing)
      const innerSize = size * 0.35 + pulse * 2;
      c.beginPath();
      c.arc(cx, cy, innerSize, 0, Math.PI * 2);
      c.fillStyle = "hsl(0 0% 10%)";
      c.fill();
      c.strokeStyle = "hsl(0 0% 20%)";
      c.lineWidth = 1.5;
      c.stroke();

      // Dust cap (center dome)
      const capSize = size * 0.15 + pulse;
      c.beginPath();
      c.arc(cx, cy, capSize, 0, Math.PI * 2);
      const capGrad = c.createRadialGradient(cx, cy, 0, cx, cy, capSize);
      capGrad.addColorStop(0, "hsl(0 0% 16%)");
      capGrad.addColorStop(1, "hsl(0 0% 8%)");
      c.fillStyle = capGrad;
      c.fill();
    };

    // Speaker positions (relative 0-1 coords)
    const positions = [
      { x: 0.08, y: 0.15, s: 0.09 },  // top-left
      { x: 0.92, y: 0.12, s: 0.08 },  // top-right
      { x: 0.05, y: 0.82, s: 0.10 },  // bottom-left
      { x: 0.95, y: 0.78, s: 0.09 },  // bottom-right
      { x: 0.50, y: 0.92, s: 0.07 },  // bottom-center
    ];

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      c.clearRect(0, 0, w, h);

      if (isPlaying) {
        phase += 0.08;
      } else {
        phase += 0.01;
      }

      const minDim = Math.min(w, h);

      for (let i = 0; i < SPEAKER_COUNT; i++) {
        const pos = positions[i];
        const cx = pos.x * w;
        const cy = pos.y * h;
        const size = pos.s * minDim;

        let pulse = 0;
        if (isPlaying) {
          pulse = Math.sin(phase + i * 1.3) * 4 + Math.sin(phase * 1.8 + i) * 2;
        }

        drawSpeaker(cx, cy, size, pulse);
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
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30"
    />
  );
};

export default BattleSpeakersBackground;
