/**
 * YAJ Snake Royale renderer — original hand-drawn 2.5D canvas art (no external
 * assets): angled top-down jungle tiles, trees/bushes/logs/ruins, hazard ground
 * warnings, croc-water tinting, and the blocky YAJ character composited separately
 * by SnakeRoyaleActors.tsx.
 */

import { GRID_H, GRID_W, JungleMap, TILE, Terrain, idx } from "@/lib/snake-royale/map";
import { SnakeRoyaleState } from "@/lib/snake-royale/engine";

export type Camera = { x: number; y: number; scale: number; vw: number; vh: number };

const SQUASH = 0.78;

const TERRAIN: Record<Terrain, string> = {
  path: "#c9a86a",
  grass: "#2f8f4d",
  water: "#1c5f86",
  shallow: "#2f8aa8",
  mud: "#6b5230",
  bridge: "#8a5c2f",
  ruins: "#8f8672",
  rock: "#7d7f74",
};

export function makeCamera(st: SnakeRoyaleState, w: number, h: number, prev?: Camera): Camera {
  const worldW = Math.max(620, Math.min(880, 700 * (w / 420)));
  const scale = w / worldW;
  const vw = worldW;
  const vh = h / scale;

  const targetX = st.x - vw / 2;
  const targetY = st.y - vh / (2 * SQUASH);
  const maxX = GRID_W * TILE - vw;
  const maxY = GRID_H * TILE - vh / SQUASH;
  const cx = clamp(targetX, -TILE, Math.max(-TILE, maxX + TILE));
  const cy = clamp(targetY, -TILE, Math.max(-TILE, maxY + TILE));

  if (!prev) return { x: cx, y: cy, scale, vw, vh };
  const k = 0.16;
  return { x: prev.x + (cx - prev.x) * k, y: prev.y + (cy - prev.y) * k, scale, vw, vh };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function drawJungle(g: CanvasRenderingContext2D, st: SnakeRoyaleState, cam: Camera, w: number, h: number) {
  const s = cam.scale;
  const sx = (wx: number) => (wx - cam.x) * s;
  const sy = (wy: number) => (wy - cam.y) * s * SQUASH;

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#123a1f");
  sky.addColorStop(0.5, "#1c5a2e");
  sky.addColorStop(1, "#0f2e1a");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const tx1 = Math.min(GRID_W - 1, Math.ceil((cam.x + cam.vw) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const ty1 = Math.min(GRID_H - 1, Math.ceil((cam.y + cam.vh / SQUASH) / TILE) + 2);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let txi = tx0; txi <= tx1; txi++) {
      const t = st.map.tiles[idx(txi, ty)];
      const x = sx(txi * TILE);
      const y = sy(ty * TILE);
      const tw = TILE * s + 1;
      const th = TILE * s * SQUASH + 1;

      g.fillStyle = TERRAIN[t];
      g.fillRect(x, y, tw, th);

      if ((txi + ty) % 2 === 0) {
        g.fillStyle = "rgba(255,255,255,0.04)";
        g.fillRect(x, y, tw, th);
      }

      if (t === "water") {
        g.fillStyle = "rgba(255,255,255,0.08)";
        const wob = Math.sin(st.t * 2 + txi * 0.5 + ty * 0.4) * 2;
        g.fillRect(x, y + th / 2 + wob, tw, 2);
      }
      if (t === "bridge") {
        g.strokeStyle = "rgba(60,35,15,0.4)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y + th / 2);
        g.lineTo(x + tw, y + th / 2);
        g.stroke();
      }
      if (t === "ruins") {
        g.strokeStyle = "rgba(255,255,255,0.14)";
        g.lineWidth = 1;
        g.strokeRect(x + 2, y + 2, tw - 4, th - 4);
      }
    }
  }

  // ground warnings under incoming rocks/branches
  for (const hz of st.impacts) {
    if (hz.impacted) continue;
    const cx = sx(hz.x);
    const cy = sy(hz.y);
    const p = 1 - Math.max(0, hz.warn) / (hz.kind === "rock" ? 1.1 : 0.9);
    g.save();
    g.strokeStyle = hz.kind === "rock" ? "rgba(180,180,180,0.95)" : "rgba(150,220,120,0.95)";
    g.lineWidth = Math.max(2, 3 * s);
    g.setLineDash([6 * s, 5 * s]);
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s, hz.radius * s * SQUASH, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = hz.kind === "rock" ? "rgba(180,180,180,0.28)" : "rgba(150,220,120,0.28)";
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s * p, hz.radius * s * SQUASH * p, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    const fallH = (1 - p) * 200 * s;
    if (hz.kind === "rock") {
      g.fillStyle = "#8b8d84";
      g.beginPath();
      g.arc(cx, cy - fallH - 8 * s, 10 * s, 0, Math.PI * 2);
      g.fill();
    } else {
      g.save();
      g.translate(cx, cy - fallH - 10 * s);
      g.rotate((1 - p) * 2);
      g.strokeStyle = "#5c4326";
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(-14 * s, 0);
      g.lineTo(14 * s, 0);
      g.stroke();
      g.restore();
    }
  }

  // props sorted by world Y so nearer things draw over
  type Drawable = { y: number; draw: () => void };
  const items: Drawable[] = [];

  for (const p of st.map.props) {
    if (p.x < cam.x - TILE * 2 || p.x > cam.x + cam.vw + TILE * 2) continue;
    if (p.y < cam.y - TILE * 3 || p.y > cam.y + cam.vh / SQUASH + TILE * 3) continue;
    items.push({ y: p.y, draw: () => drawProp(g, p.kind, sx(p.x), sy(p.y), p.scale * s, st.t) });
  }

  for (const star of st.starList) {
    if (star.taken) continue;
    const bob = Math.sin(st.t * 3 + star.x * 0.02) * 4 * s;
    items.push({ y: star.y, draw: () => drawStar(g, sx(star.x), sy(star.y) - 16 * s + bob, 11 * s) });
  }

  for (const hz of st.impacts) {
    if (!hz.impacted || hz.age >= 0.7) continue;
    items.push({ y: hz.y, draw: () => drawImpactSplat(g, hz.kind, sx(hz.x), sy(hz.y), 28 * s) });
  }

  items.sort((a, b) => a.y - b.y);
  items.forEach((i) => i.draw());

  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = "#fbbf24";
  g.shadowColor = "#fbbf24";
  g.shadowBlur = 12;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function drawImpactSplat(g: CanvasRenderingContext2D, kind: "rock" | "branch", cx: number, cy: number, size: number) {
  g.save();
  g.globalAlpha = 0.5;
  g.fillStyle = kind === "rock" ? "#8b8d84" : "#5c4326";
  g.beginPath();
  g.ellipse(cx, cy, size / 2, size / 3.4, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawProp(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, s: number, t: number) {
  const sway = Math.sin(t * 1.4 + cx * 0.01) * 0.03;
  g.save();
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + 4 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  g.fill();

  if (kind === "tree") {
    g.strokeStyle = "#5c3c1e";
    g.lineWidth = 7 * s;
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + 6 * s * sway * 8, cy - 30 * s, cx + 10 * s * sway * 8, cy - 56 * s);
    g.stroke();
    const topX = cx + 10 * s * sway * 8;
    const topY = cy - 56 * s;
    g.fillStyle = "#256b3a";
    g.beginPath();
    g.arc(topX, topY - 10 * s, 26 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2f8f4d";
    g.beginPath();
    g.arc(topX - 10 * s, topY - 2 * s, 18 * s, 0, Math.PI * 2);
    g.fill();
    g.arc(topX + 12 * s, topY, 16 * s, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "bush") {
    g.fillStyle = "#256b3a";
    g.beginPath();
    g.arc(cx - 10 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
    g.arc(cx + 10 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
    g.arc(cx, cy - 14 * s, 13 * s, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "log") {
    g.fillStyle = "#6b4423";
    g.fillRect(cx - 22 * s, cy - 10 * s, 44 * s, 12 * s);
    g.fillStyle = "#8a5a2b";
    g.beginPath();
    g.ellipse(cx - 22 * s, cy - 4 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "vine") {
    g.strokeStyle = "#3fae5c";
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(cx, cy - 60 * s);
    g.quadraticCurveTo(cx + 8 * s * sway * 10, cy - 30 * s, cx, cy - 6 * s);
    g.stroke();
  } else if (kind === "ruinWall") {
    g.fillStyle = "#a39a83";
    g.fillRect(cx - 20 * s, cy - 26 * s, 40 * s, 26 * s);
    g.fillStyle = "#8f8672";
    g.fillRect(cx - 20 * s, cy - 26 * s, 40 * s, 6 * s);
    g.strokeStyle = "rgba(0,0,0,0.2)";
    g.lineWidth = 1 * s;
    for (let i = -1; i <= 1; i++) g.strokeRect(cx - 20 * s + (i + 1) * 13 * s, cy - 20 * s, 12 * s, 18 * s);
  } else if (kind === "signpost") {
    g.fillStyle = "#8a5a2b";
    g.fillRect(cx - 2 * s, cy - 24 * s, 4 * s, 24 * s);
    g.fillStyle = "#f5e0b8";
    g.fillRect(cx - 16 * s, cy - 36 * s, 32 * s, 14 * s);
  } else if (kind === "rockProp") {
    g.fillStyle = "#8b8d84";
    g.beginPath();
    g.moveTo(cx - 18 * s, cy);
    g.lineTo(cx - 11 * s, cy - 18 * s);
    g.lineTo(cx + 4 * s, cy - 22 * s);
    g.lineTo(cx + 18 * s, cy - 6 * s);
    g.lineTo(cx + 12 * s, cy);
    g.closePath();
    g.fill();
  }
  g.restore();
}
