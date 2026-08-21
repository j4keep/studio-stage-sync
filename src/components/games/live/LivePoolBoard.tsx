import { useEffect, useRef } from "react";
import { BALL_COLORS, BALL_R, PoolState, TABLE_H, TABLE_W } from "@/lib/pool";

/** Redraws the real ball positions from a live pool match — a lightweight standalone
 *  renderer (not the full interactive PoolTable) so a spectator's feed card can mirror the
 *  table without any of the aiming/shooting machinery. */
export default function LivePoolBoard({ pool }: { pool: PoolState | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pool) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = Math.min(rect.width / TABLE_W, rect.height / TABLE_H);
    const offX = (rect.width - TABLE_W * scale) / 2;
    const offY = (rect.height - TABLE_H * scale) / 2;
    const toPx = (x: number, y: number) => [offX + x * scale, offY + y * scale];

    g.clearRect(0, 0, rect.width, rect.height);
    g.fillStyle = "#0e6b4f";
    g.fillRect(offX, offY, TABLE_W * scale, TABLE_H * scale);
    g.strokeStyle = "#5c3a1e";
    g.lineWidth = Math.max(2, 8 * scale);
    g.strokeRect(offX, offY, TABLE_W * scale, TABLE_H * scale);

    for (const b of pool.balls) {
      if (b.potted) continue;
      const [px, py] = toPx(b.x, b.y);
      const r = Math.max(1.5, BALL_R * scale);
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fillStyle = b.id === 0 ? "#f5f2ea" : BALL_COLORS[b.id] ?? "#f5f2ea";
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 1;
      g.stroke();
    }
  }, [pool]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
