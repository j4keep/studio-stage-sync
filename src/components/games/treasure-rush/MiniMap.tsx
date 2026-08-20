import { useEffect, useRef } from "react";
import { FLOOR, LEVEL, MAP_H, MAP_W, TILE } from "@/lib/treasure-rush/map";

/** Simplified mini-map: known paths, player position, exit. Treasure stays hidden. */
export default function MiniMap({ x, z, visited }: { x: number; z: number; visited: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const seen = useRef<Set<string>>(new Set());

  visited.forEach((v) => seen.current.add(v));

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const cell = Math.floor(Math.min(el.width / MAP_W, el.height / MAP_H));
    ctx.clearRect(0, 0, el.width, el.height);

    FLOOR.forEach((f) => {
      const known = seen.current.has(`${f.col},${f.row}`);
      if (!known) return;
      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillRect(f.col * cell, f.row * cell, cell, cell);
    });

    ctx.fillStyle = "#6ee7c4";
    ctx.fillRect(LEVEL.exit.col * cell - 1, LEVEL.exit.row * cell - 1, cell + 2, cell + 2);

    const pc = Math.round(x / TILE);
    const pr = Math.round(z / TILE);
    ctx.fillStyle = "#c084fc";
    ctx.beginPath();
    ctx.arc(pc * cell + cell / 2, pr * cell + cell / 2, Math.max(2, cell), 0, Math.PI * 2);
    ctx.fill();
  }, [x, z, visited]);

  return (
    <canvas
      ref={canvas}
      width={MAP_W * 3}
      height={MAP_H * 3}
      aria-label="Mini map"
      className="h-[120px] w-[86px] rounded-lg border border-white/20 bg-black/45 backdrop-blur-md"
    />
  );
}
