/**
 * YAJ Survival Island renderer — original hand-drawn 2.5D canvas art (no external
 * assets): angled top-down island tiles with dimensional side faces, palms, huts,
 * hazard ground warnings, flood water, safe-zone glow and the blocky YAJ character.
 */

import {
  ELEVATION,
  GRID_H,
  GRID_W,
  TILE,
  Terrain,
  idx,
} from "@/lib/survival-island/map";
import { IslandState, PLAYER_R, tileFlooded } from "@/lib/survival-island/engine";

export type Camera = { x: number; y: number; scale: number; vw: number; vh: number };

/** Vertical squash gives the angled top-down look. */
const SQUASH = 0.74;
const LIFT = 7;

const TERRAIN: Record<Terrain, { top: string; side: string }> = {
  water: { top: "#1b6f9c", side: "#124e70" },
  shallow: { top: "#49b6d6", side: "#2d87a4" },
  sand: { top: "#f0d9a4", side: "#c9ac74" },
  dock: { top: "#b78654", side: "#835a34" },
  bridge: { top: "#c0894f", side: "#8a5c2f" },
  grass: { top: "#67bf72", side: "#3f8b52" },
  plaza: { top: "#e7d3b3", side: "#b79f7c" },
  rock: { top: "#9aa3b0", side: "#6a7280" },
  hill: { top: "#7fcf80", side: "#4d9b5d" },
};

export function makeCamera(st: IslandState, w: number, h: number, prev?: Camera): Camera {
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

export function drawIsland(g: CanvasRenderingContext2D, st: IslandState, cam: Camera, w: number, h: number) {
  const s = cam.scale;
  const sx = (wx: number) => (wx - cam.x) * s;
  const sy = (wy: number, elev = 0) => (wy - cam.y) * s * SQUASH - elev * LIFT * s;

  // sunset sky / ocean backdrop
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2b4f86");
  sky.addColorStop(0.45, "#1b6f9c");
  sky.addColorStop(1, "#0f4b6d");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // shimmering ocean bands
  g.save();
  g.globalAlpha = 0.12;
  g.fillStyle = "#ffd9a0";
  for (let i = 0; i < 10; i++) {
    const yy = ((st.t * 18 + i * 90) % (h + 90)) - 45;
    g.fillRect(0, yy, w, 3);
  }
  g.restore();

  const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const tx1 = Math.min(GRID_W - 1, Math.ceil((cam.x + cam.vw) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const ty1 = Math.min(GRID_H - 1, Math.ceil((cam.y + cam.vh / SQUASH) / TILE) + 2);

  const flooding = st.flood.active && st.flood.rise > 0.05;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let txi = tx0; txi <= tx1; txi++) {
      const t = st.map.tiles[idx(txi, ty)];
      if (t === "water") continue;
      const collapsedPlank = t === "bridge" && st.collapsed.has(idx(txi, ty));
      const elev = ELEVATION[t];
      const x = sx(txi * TILE);
      const y = sy(ty * TILE, elev);
      const tw = TILE * s + 1;
      const th = TILE * s * SQUASH + 1;
      const pal = TERRAIN[t];

      if (collapsedPlank) {
        g.fillStyle = "rgba(20,70,100,0.55)";
        g.fillRect(x, y, tw, th);
        continue;
      }

      // side face for dimension
      if (elev > 0) {
        g.fillStyle = pal.side;
        g.fillRect(x, y + th - 1, tw, elev * LIFT * s + 2);
      }
      g.fillStyle = pal.top;
      g.fillRect(x, y, tw, th);

      // subtle tile texture
      if ((txi + ty) % 2 === 0) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        g.fillRect(x, y, tw, th);
      }

      if (t === "plaza") {
        g.strokeStyle = "rgba(255,255,255,0.18)";
        g.lineWidth = 1;
        g.strokeRect(x + 2, y + 2, tw - 4, th - 4);
      }
      if (t === "bridge" || t === "dock") {
        g.strokeStyle = "rgba(60,35,15,0.35)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y + th / 2);
        g.lineTo(x + tw, y + th / 2);
        g.stroke();
      }

      // flood water + safe-zone glow
      if (flooding) {
        if (tileFlooded(st, txi, ty)) {
          g.fillStyle = `rgba(52,168,214,${0.35 + st.flood.rise * 0.4})`;
          g.fillRect(x, y, tw, th);
          g.fillStyle = "rgba(255,255,255,0.12)";
          const wob = Math.sin(st.t * 3 + txi * 0.6 + ty * 0.4) * 2;
          g.fillRect(x, y + th / 2 + wob, tw, 2);
        } else {
          g.fillStyle = `rgba(125,224,166,${0.12 + Math.sin(st.t * 3) * 0.05})`;
          g.fillRect(x, y, tw, th);
        }
      }

      // bridge planks flashing before they drop
      if (st.collapse.active && st.collapse.phase === "warn" && st.collapse.tiles.includes(idx(txi, ty))) {
        g.fillStyle = `rgba(251,191,36,${0.3 + Math.abs(Math.sin(st.t * 12)) * 0.4})`;
        g.fillRect(x, y, tw, th);
      }
    }
  }

  // ground warnings under incoming hazards
  for (const hz of st.hazards) {
    if (hz.impacted) continue;
    const elev = ELEVATION[st.map.tiles[idx(clampT(hz.x), clampTY(hz.y))] ?? "sand"];
    const cx = sx(hz.x);
    const cy = sy(hz.y, elev);
    const p = 1 - Math.max(0, hz.warn) / (hz.kind === "crate" ? 1.25 : 1.05);
    g.save();
    g.strokeStyle = hz.kind === "crate" ? "rgba(251,146,60,0.95)" : "rgba(255,235,150,0.95)";
    g.lineWidth = Math.max(2, 3 * s);
    g.setLineDash([6 * s, 5 * s]);
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s, hz.radius * s * SQUASH, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = hz.kind === "crate" ? "rgba(251,146,60,0.28)" : "rgba(255,235,150,0.25)";
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s * p, hz.radius * s * SQUASH * p, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // the falling object itself
    const fallH = (1 - p) * 220 * s;
    if (hz.kind === "coconut") {
      g.fillStyle = "#7a4a22";
      g.beginPath();
      g.arc(cx, cy - fallH - 8 * s, 9 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.beginPath();
      g.arc(cx - 3 * s, cy - fallH - 11 * s, 3 * s, 0, Math.PI * 2);
      g.fill();
    } else {
      drawCrate(g, cx, cy - fallH - 16 * s, 26 * s, (1 - p) * 3);
    }
  }

  // props, stars, pickups and player sorted by world Y so nearer things draw over
  type Drawable = { y: number; draw: () => void };
  const items: Drawable[] = [];

  for (const p of st.map.props) {
    if (p.x < cam.x - TILE * 2 || p.x > cam.x + cam.vw + TILE * 2) continue;
    if (p.y < cam.y - TILE * 3 || p.y > cam.y + cam.vh / SQUASH + TILE * 3) continue;
    const elev = ELEVATION[st.map.tiles[idx(clampT(p.x), clampTY(p.y))] ?? "sand"];
    items.push({ y: p.y, draw: () => drawProp(g, st, p.kind, sx(p.x), sy(p.y, elev), p.scale * s, st.t) });
  }

  for (const star of st.starList) {
    if (star.taken) continue;
    const elev = ELEVATION[st.map.tiles[idx(clampT(star.x), clampTY(star.y))] ?? "sand"];
    const bob = Math.sin(st.t * 3 + star.x * 0.02) * 4 * s;
    items.push({
      y: star.y,
      draw: () => drawStar(g, sx(star.x), sy(star.y, elev) - 16 * s + bob, 11 * s, "#fbbf24"),
    });
  }

  for (const pu of st.pickups) {
    const elev = ELEVATION[st.map.tiles[idx(clampT(pu.x), clampTY(pu.y))] ?? "sand"];
    const bob = Math.sin(st.t * 4 + pu.id) * 4 * s;
    items.push({ y: pu.y, draw: () => drawPickup(g, pu.kind, sx(pu.x), sy(pu.y, elev) - 18 * s + bob, 13 * s) });
  }

  for (const hz of st.hazards) {
    if (!hz.impacted || hz.kind !== "crate" || hz.linger <= 0) continue;
    const elev = ELEVATION[st.map.tiles[idx(clampT(hz.x), clampTY(hz.y))] ?? "sand"];
    items.push({ y: hz.y, draw: () => drawCrate(g, sx(hz.x), sy(hz.y, elev) - 14 * s, 30 * s, 0) });
  }

  items.sort((a, b) => a.y - b.y);
  items.forEach((i) => i.draw());

  // wind streaks + direction arrow
  if (st.wind.active) {
    g.save();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const seed = i * 97.13;
      const px = ((seed * 13 + st.t * st.wind.dx * 420) % (w + 120)) - 60;
      const py = ((seed * 29 + st.t * st.wind.dy * 420) % (h + 120)) - 60;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + st.wind.dx * 26, py + st.wind.dy * 26);
      g.stroke();
    }
    g.restore();
  }

  // vignette to focus the action
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

const clampT = (x: number) => Math.max(0, Math.min(GRID_W - 1, Math.floor(x / TILE)));
const clampTY = (y: number) => Math.max(0, Math.min(GRID_H - 1, Math.floor(y / TILE)));

function drawCrate(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, spin: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(spin);
  g.fillStyle = "#c98b45";
  g.fillRect(-size / 2, -size / 2, size, size);
  g.strokeStyle = "#7d5122";
  g.lineWidth = Math.max(1.5, size * 0.09);
  g.strokeRect(-size / 2, -size / 2, size, size);
  g.beginPath();
  g.moveTo(-size / 2, -size / 2);
  g.lineTo(size / 2, size / 2);
  g.moveTo(size / 2, -size / 2);
  g.lineTo(-size / 2, size / 2);
  g.stroke();
  g.restore();
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.shadowColor = color;
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

function drawPickup(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, r: number) {
  const tone = kind === "shield" ? "#38bdf8" : kind === "speed" ? "#fb7185" : "#f87189";
  g.save();
  g.fillStyle = `${tone}33`;
  g.strokeStyle = tone;
  g.lineWidth = Math.max(1.5, r * 0.18);
  g.shadowColor = tone;
  g.shadowBlur = 12;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = tone;
  if (kind === "shield") {
    g.beginPath();
    g.moveTo(cx, cy - r * 0.55);
    g.lineTo(cx + r * 0.45, cy - r * 0.2);
    g.lineTo(cx, cy + r * 0.6);
    g.lineTo(cx - r * 0.45, cy - r * 0.2);
    g.closePath();
    g.fill();
  } else if (kind === "speed") {
    g.beginPath();
    g.moveTo(cx - r * 0.1, cy - r * 0.6);
    g.lineTo(cx + r * 0.45, cy - r * 0.05);
    g.lineTo(cx + r * 0.05, cy - r * 0.05);
    g.lineTo(cx + r * 0.15, cy + r * 0.6);
    g.lineTo(cx - r * 0.45, cy - r * 0.05);
    g.lineTo(cx - r * 0.05, cy - r * 0.05);
    g.closePath();
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(cx, cy + r * 0.5);
    g.bezierCurveTo(cx - r, cy - r * 0.25, cx - r * 0.35, cy - r * 0.85, cx, cy - r * 0.3);
    g.bezierCurveTo(cx + r * 0.35, cy - r * 0.85, cx + r, cy - r * 0.25, cx, cy + r * 0.5);
    g.fill();
  }
  g.restore();
}

function drawProp(
  g: CanvasRenderingContext2D,
  st: IslandState,
  kind: string,
  cx: number,
  cy: number,
  s: number,
  t: number,
) {
  const sway = st.wind.active ? Math.sin(t * 6) * 0.08 * st.wind.dx : Math.sin(t * 1.4) * 0.02;
  g.save();
  // contact shadow
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + 4 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  g.fill();

  if (kind === "palm") {
    g.strokeStyle = "#8a5a2b";
    g.lineWidth = 5 * s;
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + 8 * s * sway * 6, cy - 34 * s, cx + 14 * s * sway * 6, cy - 62 * s);
    g.stroke();
    const topX = cx + 14 * s * sway * 6;
    const topY = cy - 62 * s;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + sway * 3;
      g.strokeStyle = i % 2 ? "#2f8f4d" : "#3fae5c";
      g.lineWidth = 7 * s;
      g.beginPath();
      g.moveTo(topX, topY);
      g.quadraticCurveTo(topX + Math.cos(a) * 20 * s, topY + Math.sin(a) * 12 * s - 8 * s, topX + Math.cos(a) * 34 * s, topY + Math.sin(a) * 20 * s + 4 * s);
      g.stroke();
    }
    g.fillStyle = "#6b4423";
    g.beginPath();
    g.arc(topX + 4 * s, topY + 6 * s, 4 * s, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "hut") {
    g.fillStyle = "#d8b483";
    g.fillRect(cx - 20 * s, cy - 30 * s, 40 * s, 30 * s);
    g.fillStyle = "#b5906a";
    g.fillRect(cx - 20 * s, cy - 12 * s, 40 * s, 12 * s);
    g.fillStyle = "#8a5a2b";
    g.beginPath();
    g.moveTo(cx - 26 * s, cy - 28 * s);
    g.lineTo(cx, cy - 50 * s);
    g.lineTo(cx + 26 * s, cy - 28 * s);
    g.closePath();
    g.fill();
    g.fillStyle = "#5c3c1e";
    g.fillRect(cx - 7 * s, cy - 20 * s, 14 * s, 20 * s);
  } else if (kind === "rock") {
    g.fillStyle = "#939dab";
    g.beginPath();
    g.moveTo(cx - 18 * s, cy);
    g.lineTo(cx - 11 * s, cy - 18 * s);
    g.lineTo(cx + 4 * s, cy - 22 * s);
    g.lineTo(cx + 18 * s, cy - 6 * s);
    g.lineTo(cx + 12 * s, cy);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath();
    g.moveTo(cx - 11 * s, cy - 18 * s);
    g.lineTo(cx + 4 * s, cy - 22 * s);
    g.lineTo(cx - 2 * s, cy - 10 * s);
    g.closePath();
    g.fill();
  } else if (kind === "campfire") {
    g.fillStyle = "#6b4423";
    g.fillRect(cx - 14 * s, cy - 6 * s, 28 * s, 6 * s);
    const flick = 1 + Math.sin(t * 12) * 0.16;
    g.fillStyle = "#fb923c";
    g.beginPath();
    g.moveTo(cx, cy - 32 * s * flick);
    g.lineTo(cx + 10 * s, cy - 6 * s);
    g.lineTo(cx - 10 * s, cy - 6 * s);
    g.closePath();
    g.fill();
    g.fillStyle = "#fde047";
    g.beginPath();
    g.moveTo(cx, cy - 20 * s * flick);
    g.lineTo(cx + 5 * s, cy - 6 * s);
    g.lineTo(cx - 5 * s, cy - 6 * s);
    g.closePath();
    g.fill();
  } else if (kind === "barrel") {
    g.fillStyle = "#a97245";
    g.fillRect(cx - 10 * s, cy - 22 * s, 20 * s, 22 * s);
    g.strokeStyle = "#6f4a2a";
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(cx - 10 * s, cy - 16 * s);
    g.lineTo(cx + 10 * s, cy - 16 * s);
    g.moveTo(cx - 10 * s, cy - 8 * s);
    g.lineTo(cx + 10 * s, cy - 8 * s);
    g.stroke();
  } else if (kind === "sign") {
    g.fillStyle = "#8a5a2b";
    g.fillRect(cx - 2 * s, cy - 24 * s, 4 * s, 24 * s);
    g.fillStyle = "#f5e0b8";
    g.fillRect(cx - 16 * s, cy - 36 * s, 32 * s, 14 * s);
    g.fillStyle = "#8a5a2b";
    g.fillRect(cx - 11 * s, cy - 31 * s, 22 * s, 2 * s);
    g.fillRect(cx - 11 * s, cy - 27 * s, 14 * s, 2 * s);
  }
  g.restore();
}

/** Drawn separately by the mini-map component. */
export { SQUASH };
