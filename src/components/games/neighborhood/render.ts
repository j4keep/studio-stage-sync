/**
 * YAJ Neighborhood Adventure renderer — hand-drawn 2.5D canvas art (no external assets),
 * following the same shape as Survival Island's renderer (src/components/games/survival-island/render.ts):
 * angled top-down tiles, a smoothed follow camera, and dimensional props drawn as their own
 * little blocks rather than via terrain elevation (this map has none — every tile is walkable,
 * only props are solid).
 */

import { GRID_H, GRID_W, PropKind, TILE, Terrain, idx } from "@/lib/neighborhood/map";
import { NeighborhoodState, waypointTarget } from "@/lib/neighborhood/engine";

export type Camera = { x: number; y: number; scale: number; vw: number; vh: number };

const SQUASH = 0.78;

const TERRAIN: Record<Terrain, { top: string; line?: string }> = {
  grass: { top: "#7fc98a" },
  sidewalk: { top: "#cfd3d6" },
  street: { top: "#3a4048", line: "#e7c661" },
  plaza: { top: "#e3d3ae" },
  alley: { top: "#9aa0a8" },
  court: { top: "#c96b3f" },
};

export function makeCamera(st: NeighborhoodState, w: number, h: number, prev?: Camera): Camera {
  const desiredWorldW = Math.max(560, Math.min(820, 660 * (w / 420)));
  const scaleFromWidth = w / desiredWorldW;
  // On a tall/narrow viewport, framing purely by width can ask for more vertical world-space
  // than this (much smaller than an island) map actually has, leaving a blank gap below the
  // block. Zooming in enough to keep the vertical extent within world bounds prevents that.
  const scaleFromHeight = h / (GRID_H * TILE * SQUASH);
  const scale = Math.max(scaleFromWidth, scaleFromHeight);
  const vw = w / scale;
  const vh = h / scale;

  const targetX = st.x - vw / 2;
  const targetY = st.y - vh / (2 * SQUASH);
  const maxX = GRID_W * TILE - vw;
  const maxY = GRID_H * TILE - vh / SQUASH;
  const cx = clamp(targetX, -TILE, Math.max(-TILE, maxX + TILE));
  const cy = clamp(targetY, -TILE, Math.max(-TILE, maxY + TILE));

  if (!prev) return { x: cx, y: cy, scale, vw, vh };
  const k = 0.18;
  return { x: prev.x + (cx - prev.x) * k, y: prev.y + (cy - prev.y) * k, scale, vw, vh };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function drawNeighborhood(g: CanvasRenderingContext2D, st: NeighborhoodState, cam: Camera, w: number, h: number) {
  const s = cam.scale;
  const sx = (wx: number) => (wx - cam.x) * s;
  const sy = (wy: number) => (wy - cam.y) * s * SQUASH;

  // Soft daytime sky.
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#bfe6ee");
  sky.addColorStop(1, "#eaf6ec");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const tx1 = Math.min(GRID_W - 1, Math.ceil((cam.x + cam.vw) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const ty1 = Math.min(GRID_H - 1, Math.ceil((cam.y + cam.vh / SQUASH) / TILE) + 2);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let txi = tx0; txi <= tx1; txi++) {
      const t = st.map.tiles[idx(txi, ty)];
      const pal = TERRAIN[t];
      const x = sx(txi * TILE);
      const y = sy(ty * TILE);
      const tw = TILE * s + 1;
      const th = TILE * s * SQUASH + 1;

      g.fillStyle = pal.top;
      g.fillRect(x, y, tw, th);

      if ((txi + ty) % 2 === 0) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        g.fillRect(x, y, tw, th);
      }
      if (t === "street" && txi % 2 === 0) {
        g.fillStyle = "rgba(231,198,97,0.55)";
        g.fillRect(x + tw / 2 - 1, y, 2, th);
      }
      if (t === "plaza") {
        g.strokeStyle = "rgba(120,90,50,0.15)";
        g.lineWidth = 1;
        g.strokeRect(x + 1, y + 1, tw - 2, th - 2);
      }
      if (t === "court") {
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 1;
        g.strokeRect(x + 2, y + 2, tw - 4, th - 4);
      }
    }
  }

  type Drawable = { y: number; draw: () => void };
  const items: Drawable[] = [];

  for (const p of st.map.props) {
    if (p.x < cam.x - TILE * 2 || p.x > cam.x + cam.vw + TILE * 2) continue;
    if (p.y < cam.y - TILE * 3 || p.y > cam.y + cam.vh / SQUASH + TILE * 3) continue;
    items.push({ y: p.y, draw: () => drawProp(g, p.kind, sx(p.x), sy(p.y), p.scale * s, st.t, p.label) });
  }

  for (let i = 0; i < st.map.starSpots.length; i++) {
    if (st.starsCollected[i]) continue;
    const star = st.map.starSpots[i];
    const bob = Math.sin(st.t * 3 + star.x * 0.02) * 4 * s;
    items.push({ y: star.y, draw: () => drawStar(g, sx(star.x), sy(star.y) - 20 * s + bob, 11 * s) });
  }

  items.sort((a, b) => a.y - b.y);
  items.forEach((i) => i.draw());

  // waypoint marker on the destination, if any.
  if (st.dialogue === null && st.openLocation === null) {
    const wp = waypointTarget(st);
    if (wp) {
      const wx = sx(wp.x);
      const wy = sy(wp.y) - 60 * s;
      const bob = Math.sin(st.t * 3) * 5 * s;
      g.save();
      g.translate(wx, wy + bob);
      g.fillStyle = "#6B3FA0";
      g.beginPath();
      g.moveTo(0, -10 * s);
      g.lineTo(8 * s, 6 * s);
      g.lineTo(-8 * s, 6 * s);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(20,20,30,0.18)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = "#FFD166";
  g.shadowColor = "#FFD166";
  g.shadowBlur = 12;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function building(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  w: number,
  h: number,
  wallColor: string,
  roofColor: string,
  label?: string,
) {
  g.save();
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.beginPath();
  g.ellipse(cx, cy + 4 * s, w * 0.6, 8 * s, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = wallColor;
  g.fillRect(cx - (w / 2) * s, cy - h * s, w * s, h * s);
  g.fillStyle = roofColor;
  g.fillRect(cx - (w / 2) * s, cy - h * s - 10 * s, w * s, 12 * s);

  g.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < Math.floor(w / 14); i++) {
    g.fillRect(cx - (w / 2) * s + (6 + i * 14) * s, cy - (h - 8) * s, 8 * s, 8 * s);
  }

  if (label) {
    g.fillStyle = "#ffffff";
    g.font = `${Math.max(8, 8 * s)}px sans-serif`;
    g.textAlign = "center";
    g.fillText(label, cx, cy - h * s - 14 * s);
  }
  g.restore();
}

function drawProp(g: CanvasRenderingContext2D, kind: PropKind, cx: number, cy: number, s: number, t: number, label?: string) {
  switch (kind) {
    case "cafe":
      building(g, cx, cy, s, 90, 46, "#6B3FA0", "#4a2a72", label);
      break;
    case "corner_store":
      building(g, cx, cy, s, 90, 46, "#2FB6C4", "#1f7d87", label);
      break;
    case "community_center":
      building(g, cx, cy, s, 104, 52, "#FF7A59", "#c9573a", label);
      break;
    case "apartment":
      building(g, cx, cy, s, 80, 78, "#5b5f78", "#40435a", label);
      break;
    case "hoop": {
      g.save();
      g.strokeStyle = "#8a5a2b";
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy - 46 * s);
      g.stroke();
      g.fillStyle = "#e8e8e8";
      g.fillRect(cx - 2 * s, cy - 50 * s, 16 * s, 12 * s);
      g.strokeStyle = "#e2622f";
      g.lineWidth = 2.5 * s;
      g.beginPath();
      g.arc(cx + 12 * s, cy - 40 * s, 6 * s, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      break;
    }
    case "bench": {
      g.save();
      g.fillStyle = "#8a5a2b";
      g.fillRect(cx - 16 * s, cy - 10 * s, 32 * s, 4 * s);
      g.fillRect(cx - 16 * s, cy - 3 * s, 32 * s, 3 * s);
      g.fillStyle = "#5c3c1e";
      g.fillRect(cx - 15 * s, cy - 6 * s, 3 * s, 8 * s);
      g.fillRect(cx + 12 * s, cy - 6 * s, 3 * s, 8 * s);
      g.restore();
      break;
    }
    case "tree": {
      const sway = Math.sin(t * 1.2 + cx * 0.01) * 0.03;
      g.save();
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.beginPath();
      g.ellipse(cx, cy + 3 * s, 14 * s, 5 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#7a4a22";
      g.lineWidth = 5 * s;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + sway * 60 * s, cy - 34 * s);
      g.stroke();
      g.fillStyle = "#3fae5c";
      g.beginPath();
      g.arc(cx + sway * 60 * s, cy - 46 * s, 20 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#4fc46e";
      g.beginPath();
      g.arc(cx + sway * 60 * s - 6 * s, cy - 52 * s, 12 * s, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    }
    case "lamp": {
      g.save();
      g.strokeStyle = "#3a3f4a";
      g.lineWidth = 3 * s;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy - 40 * s);
      g.stroke();
      g.fillStyle = "#FFD166";
      g.shadowColor = "#FFD166";
      g.shadowBlur = 8;
      g.beginPath();
      g.arc(cx, cy - 42 * s, 4 * s, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    }
    case "fountain": {
      g.save();
      g.fillStyle = "rgba(0,0,0,0.15)";
      g.beginPath();
      g.ellipse(cx, cy + 4 * s, 22 * s, 8 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c9b98a";
      g.beginPath();
      g.ellipse(cx, cy, 22 * s, 10 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2FB6C4";
      g.beginPath();
      g.ellipse(cx, cy - 2 * s, 16 * s, 7 * s, 0, 0, Math.PI * 2);
      g.fill();
      const spray = 1 + Math.sin(t * 6) * 0.12;
      g.fillStyle = "rgba(255,255,255,0.65)";
      g.beginPath();
      g.ellipse(cx, cy - 14 * s * spray, 3 * s, 10 * s * spray, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    }
    case "mural": {
      g.save();
      g.fillStyle = "#e7dcc9";
      g.fillRect(cx - 30 * s, cy - 38 * s, 60 * s, 38 * s);
      g.fillStyle = "#6B3FA0";
      g.fillRect(cx - 26 * s, cy - 34 * s, 24 * s, 14 * s);
      g.fillStyle = "#FF7A59";
      g.fillRect(cx + 2 * s, cy - 34 * s, 24 * s, 14 * s);
      g.fillStyle = "#2FB6C4";
      g.fillRect(cx - 26 * s, cy - 16 * s, 52 * s, 12 * s);
      g.restore();
      break;
    }
    case "bus_shelter": {
      g.save();
      g.fillStyle = "#8f97a3";
      g.fillRect(cx - 22 * s, cy - 34 * s, 4 * s, 34 * s);
      g.fillRect(cx + 18 * s, cy - 34 * s, 4 * s, 34 * s);
      g.fillStyle = "rgba(150,200,220,0.45)";
      g.fillRect(cx - 24 * s, cy - 40 * s, 52 * s, 8 * s);
      g.fillStyle = "rgba(180,220,235,0.3)";
      g.fillRect(cx - 20 * s, cy - 30 * s, 40 * s, 22 * s);
      if (label) {
        g.fillStyle = "#2b2140";
        g.font = `${Math.max(8, 8 * s)}px sans-serif`;
        g.textAlign = "center";
        g.fillText(label, cx, cy - 46 * s);
      }
      g.restore();
      break;
    }
    case "planter": {
      g.save();
      g.fillStyle = "#8a5a2b";
      g.fillRect(cx - 10 * s, cy - 10 * s, 20 * s, 10 * s);
      g.fillStyle = "#3fae5c";
      g.beginPath();
      g.arc(cx, cy - 14 * s, 9 * s, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    }
    case "sign":
    case "crate": {
      g.save();
      g.fillStyle = "#c98b45";
      g.fillRect(cx - 12 * s, cy - 12 * s, 24 * s, 24 * s);
      g.strokeStyle = "#7d5122";
      g.lineWidth = 2 * s;
      g.strokeRect(cx - 12 * s, cy - 12 * s, 24 * s, 24 * s);
      g.restore();
      break;
    }
  }
}
