import { useEffect, useRef } from "react";
import { ELEVATION, GRID_H, GRID_W, TILE, idx } from "@/lib/survival-island/map";
import { IslandState, tileFlooded } from "@/lib/survival-island/engine";

const W = 92;
const H = 70;

/** Tiny island overview: land shape, flooded tiles, safe high ground and the player. */
export default function IslandMiniMap({ st }: { st: IslandState }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cw = W / GRID_W;
    const ch = H / GRID_H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(12,52,78,0.9)";
    g.fillRect(0, 0, W, H);

    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const t = st.map.tiles[idx(tx, ty)];
        if (t === "water") continue;
        let color = "#8fd39a";
        if (t === "sand") color = "#efd9a8";
        else if (t === "shallow") color = "#4fb2d0";
        else if (t === "plaza") color = "#f2e2c4";
        else if (t === "rock") color = "#9aa3b0";
        else if (t === "hill") color = "#6fc47f";
        else if (t === "bridge" || t === "dock") color = "#c08a52";
        if (st.flood.active && st.flood.rise > 0.2) {
          if (tileFlooded(st, tx, ty)) color = "#2f8fb8";
          else if (ELEVATION[t] >= 3) color = "#c8f7d6";
        }
        g.fillStyle = color;
        g.fillRect(tx * cw, ty * ch, cw + 0.6, ch + 0.6);
      }
    }

    for (const s of st.starList) {
      if (s.taken) continue;
      g.fillStyle = "#fbbf24";
      g.fillRect((s.x / TILE) * cw - 1, (s.y / TILE) * ch - 1, 2, 2);
    }
    for (const hz of st.hazards) {
      if (hz.impacted) continue;
      g.fillStyle = "rgba(248,113,113,0.95)";
      g.fillRect((hz.x / TILE) * cw - 1.5, (hz.y / TILE) * ch - 1.5, 3, 3);
    }

    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc((st.x / TILE) * cw, (st.y / TILE) * ch, 2.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#1d4ed8";
    g.lineWidth = 1;
    g.stroke();
  });

  return (
    <canvas
      ref={ref}
      style={{ width: W, height: H }}
      className="rounded-lg border border-white/20 bg-black/40"
      aria-label="Island map"
    />
  );
}
