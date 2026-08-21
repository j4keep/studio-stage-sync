import { useEffect, useRef } from "react";
import { GRID_H, GRID_W, TILE, idx } from "@/lib/neighborhood/map";
import { NeighborhoodState, waypointTarget } from "@/lib/neighborhood/engine";

const W = 96;
const H = 78;

const TERRAIN_COLOR: Record<string, string> = {
  grass: "#7fc98a",
  sidewalk: "#cfd3d6",
  street: "#3a4048",
  plaza: "#e3d3ae",
  alley: "#9aa0a8",
  court: "#c96b3f",
};

/**
 * Compact overview: player position, always-visible landmark dots, the active mission's
 * destination highlighted, and fog-of-war over anywhere the player hasn't walked near yet.
 * Hidden stars/tokens are never drawn here, per the design brief.
 */
export default function NeighborhoodMiniMap({ st }: { st: NeighborhoodState }) {
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
    g.fillStyle = "rgba(20,20,26,0.92)";
    g.fillRect(0, 0, W, H);

    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const visited = st.visited.has(idx(tx, ty));
        if (!visited) continue;
        const t = st.map.tiles[idx(tx, ty)];
        g.fillStyle = TERRAIN_COLOR[t] ?? "#7fc98a";
        g.fillRect(tx * cw, ty * ch, cw + 0.6, ch + 0.6);
      }
    }

    const wp = waypointTarget(st);
    for (const loc of st.map.locations) {
      const lx = (loc.x / TILE) * cw;
      const ly = (loc.y / TILE) * ch;
      const isTarget = wp && Math.hypot(wp.x - loc.x, wp.y - loc.y) < 60;
      g.fillStyle = isTarget ? "#FFD166" : "rgba(255,255,255,0.65)";
      g.beginPath();
      g.arc(lx, ly, isTarget ? 2.4 : 1.6, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc((st.x / TILE) * cw, (st.y / TILE) * ch, 2.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#6B3FA0";
    g.lineWidth = 1;
    g.stroke();
  });

  return (
    <canvas
      ref={ref}
      style={{ width: W, height: H }}
      className="rounded-lg border border-white/20 bg-black/40"
      aria-label="Neighborhood map"
    />
  );
}
