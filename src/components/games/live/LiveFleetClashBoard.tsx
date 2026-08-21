import { useEffect, useRef } from "react";
import { useFleetClashSpectate } from "@/hooks/use-fleetclash-live";

const LATERAL_RANGE = 20; // roughly the widest the river/curve ever gets, either side of center

/** A live top-down tracker of the actual race — both boats' real position and progress,
 *  broadcast straight from the player's client a few times a second. Not the full 3D scene
 *  (too heavy to run one per spectator), but the real data, moving live. */
export default function LiveFleetClashBoard({ gameId }: { gameId: string }) {
  const sample = useFleetClashSpectate(gameId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    g.clearRect(0, 0, w, h);
    const river = g.createLinearGradient(0, 0, 0, h);
    river.addColorStop(0, "#1a4f72");
    river.addColorStop(1, "#169bc9");
    g.fillStyle = river;
    g.fillRect(w * 0.18, 0, w * 0.64, h);
    g.fillStyle = "#3e7d50";
    g.fillRect(0, 0, w * 0.18, h);
    g.fillRect(w * 0.82, 0, w * 0.18, h);

    if (!sample) return;

    const laneX = (x: number) => w * 0.5 + (x / LATERAL_RANGE) * (w * 0.28);
    const laneY = (progress: number) => h - 24 - progress * (h - 48);

    // Finish line.
    g.fillStyle = "#ffd84a";
    g.fillRect(w * 0.18, 20, w * 0.64, 3);

    const boat = (x: number, progress: number, color: string) => {
      const px = laneX(x);
      const py = laneY(progress);
      g.beginPath();
      g.arc(px, py, Math.max(4, w * 0.035), 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.stroke();
    };

    boat(sample.rivalX, sample.rivalProgress, "#ef6a57");
    boat(sample.x, sample.progress, "#7f4be8");
  }, [sample]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
