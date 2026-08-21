/**
 * YAJ Fleet Clash — hand-drawn 2D canvas art for one water zone (either "enemy waters" or
 * "your waters"). Deliberately flat 2D rather than a 3D engine: the battle screen shows two
 * zones on-screen at once, so this keeps the whole board light on mobile.
 *
 * The 10x10 logical grid from src/lib/battleship.ts is untouched — this module only maps
 * grid cells onto pixel positions inside a themed ocean scene and draws boats/crew/effects at
 * those positions. Tapping the canvas maps a pixel back to a grid cell the same way.
 */

import { BOARD_SIZE, Fleet, ShipId } from "@/lib/battleship";

export const VIEW = 340;
export const CELL = VIEW / BOARD_SIZE;

export type DamageTier = "healthy" | "damaged" | "critical" | "disabled";

export function damageTier(hits: boolean[]): DamageTier {
  const taken = hits.filter(Boolean).length;
  if (taken === 0) return "healthy";
  if (taken === hits.length) return "disabled";
  if (taken >= hits.length - 1) return "critical";
  return "damaged";
}

const BOAT_COLOR: Record<ShipId, { hull: string; deck: string }> = {
  carrier: { hull: "#2FB6C4", deck: "#1c7d87" }, // Voyager
  battleship: { hull: "#6B3FA0", deck: "#472a6b" }, // Clipper
  cruiser: { hull: "#FF7A59", deck: "#c9573a" }, // Skimmer
  submarine: { hull: "#FFD166", deck: "#c9a13f" }, // Runner
  destroyer: { hull: "#7dd3a0", deck: "#4f9a6d" }, // Skiff
};

/** Fixed decorative terrain per zone — same every game, purely visual (the invisible grid
 *  underneath doesn't care what's drawn where). Two slightly different layouts so the two
 *  zones on screen don't look identical. */
const ISLANDS_A = [
  { cx: 0.5, cy: 0.6, r: 1.1 },
  { cx: 8.7, cy: 1.3, r: 0.75 },
];
const ISLANDS_B = [
  { cx: 9.2, cy: 8.6, r: 1.15 },
  { cx: 0.6, cy: 8.2, r: 0.7 },
];
const ROCKS = [
  { cx: 3.4, cy: 0.4, r: 0.3 },
  { cx: 6.1, cy: 9.5, r: 0.32 },
  { cx: 9.5, cy: 4.6, r: 0.26 },
];
const BUOYS = [
  { cx: 4.6, cy: 4.4 },
  { cx: 1.8, cy: 6.6 },
];

function toPx(gx: number, gy: number) {
  return { x: gx * CELL, y: gy * CELL };
}

export function cellFromPoint(px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor(px / CELL);
  const y = Math.floor(py / CELL);
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
  return { x, y };
}

function palm(g: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  g.save();
  g.strokeStyle = "#8a5a2b";
  g.lineWidth = 2.5 * s;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + 6 * s * sway, y - 14 * s, x + 9 * s * sway, y - 24 * s);
  g.stroke();
  const topX = x + 9 * s * sway;
  const topY = y - 24 * s;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 2.6) * i - Math.PI * 0.85;
    g.strokeStyle = i % 2 ? "#2f8f4d" : "#3fae5c";
    g.lineWidth = 3.5 * s;
    g.beginPath();
    g.moveTo(topX, topY);
    g.quadraticCurveTo(topX + Math.cos(a) * 10 * s, topY + Math.sin(a) * 6 * s - 4 * s, topX + Math.cos(a) * 16 * s, topY + Math.sin(a) * 10 * s + 2 * s);
    g.stroke();
  }
  g.restore();
}

function island(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  const { x, y } = toPx(cx, cy);
  const px = r * CELL;
  g.save();
  // shallow water halo
  const halo = g.createRadialGradient(x, y, px * 0.6, x, y, px * 1.7);
  halo.addColorStop(0, "rgba(255,255,255,0.28)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, px * 1.7, 0, Math.PI * 2);
  g.fill();
  // sand
  g.fillStyle = "#e8d4a0";
  g.beginPath();
  g.arc(x, y, px, 0, Math.PI * 2);
  g.fill();
  // grass cap
  g.fillStyle = "#6fbf6f";
  g.beginPath();
  g.arc(x - px * 0.1, y - px * 0.15, px * 0.72, 0, Math.PI * 2);
  g.fill();
  palm(g, x - px * 0.15, y - px * 0.05, Math.max(0.55, px * 0.045), Math.sin(t * 1.1) * 0.4);
  if (px > 16) palm(g, x + px * 0.35, y + px * 0.2, Math.max(0.45, px * 0.035), Math.sin(t * 1.1 + 1) * 0.4);
  g.restore();
}

function rock(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const { x, y } = toPx(cx, cy);
  const px = r * CELL;
  g.save();
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.beginPath();
  g.arc(x, y, px * 1.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8a94a3";
  g.beginPath();
  g.moveTo(x - px, y + px * 0.4);
  g.lineTo(x - px * 0.5, y - px);
  g.lineTo(x + px * 0.3, y - px * 0.8);
  g.lineTo(x + px, y + px * 0.2);
  g.lineTo(x + px * 0.5, y + px * 0.5);
  g.closePath();
  g.fill();
  g.restore();
}

function buoy(g: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  const { x, y } = toPx(cx, cy);
  const bob = Math.sin(t * 2 + cx) * 2;
  g.save();
  g.fillStyle = "rgba(0,0,0,0.15)";
  g.beginPath();
  g.ellipse(x, y + 5, 7, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#FF7A59";
  g.beginPath();
  g.arc(x, y + bob, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.fillRect(x - 5, y + bob - 1.2, 10, 2.4);
  g.restore();
}

/** Base water + waves + fixed decorative terrain for one zone. Draw first, every frame. */
export function drawWater(g: CanvasRenderingContext2D, t: number, variant: "a" | "b", dim: boolean) {
  const sky = g.createLinearGradient(0, 0, 0, VIEW);
  sky.addColorStop(0, dim ? "hsl(205 45% 22%)" : "hsl(198 62% 46%)");
  sky.addColorStop(1, dim ? "hsl(210 50% 14%)" : "hsl(206 60% 30%)");
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW, VIEW);

  g.save();
  g.globalAlpha = dim ? 0.08 : 0.14;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const yy = ((t * 22 + i * 52) % (VIEW + 60)) - 30;
    g.beginPath();
    g.moveTo(0, yy);
    for (let x = 0; x <= VIEW; x += 14) g.lineTo(x, yy + Math.sin(x * 0.06 + t * 1.6 + i) * 4);
    g.stroke();
  }
  g.restore();

  const islands = variant === "a" ? ISLANDS_A : ISLANDS_B;
  islands.forEach((isl) => island(g, isl.cx, isl.cy, isl.r, t));
  ROCKS.forEach((r) => rock(g, r.cx, r.cy, r.r));
  BUOYS.forEach((b) => buoy(g, b.cx, b.cy, t));

  // grid line hints — sector seams, not a spreadsheet: very faint, only every other line
  g.save();
  g.globalAlpha = 0.05;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1;
  for (let i = 2; i < BOARD_SIZE; i += 2) {
    g.beginPath();
    g.moveTo(i * CELL, 0);
    g.lineTo(i * CELL, VIEW);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * CELL);
    g.lineTo(VIEW, i * CELL);
    g.stroke();
  }
  g.restore();
}

/** A small flat crew figure standing on deck — same blocky proportions as the YAJ character
 *  family, drawn flat since this scene doesn't carry a 3D rig. */
function crew(g: CanvasRenderingContext2D, x: number, y: number, s: number, pose: "idle" | "duck" | "wave" | "celebrate", t: number, seed: number) {
  g.save();
  g.translate(x, y);
  const bob = Math.sin(t * 2.4 + seed) * 0.6;
  g.translate(0, pose === "duck" ? 2.5 * s : bob);
  const crouch = pose === "duck" ? 0.6 : 1;
  // legs
  g.fillStyle = "#2c3350";
  g.fillRect(-3 * s, 3 * s * crouch, 2.4 * s, 4 * s * crouch);
  g.fillRect(0.6 * s, 3 * s * crouch, 2.4 * s, 4 * s * crouch);
  // torso
  g.fillStyle = "#6B3FA0";
  g.fillRect(-3.4 * s, -2 * s * crouch, 6.8 * s, 5.5 * s * crouch);
  // arms
  g.strokeStyle = "#f2c396";
  g.lineWidth = 2 * s;
  g.lineCap = "round";
  if (pose === "wave") {
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(6 * s, -6 * s + Math.sin(t * 8) * 1.5 * s);
    g.stroke();
  } else if (pose === "celebrate") {
    g.beginPath();
    g.moveTo(-3.2 * s, -1 * s);
    g.lineTo(-5.5 * s, -7 * s);
    g.stroke();
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(5.5 * s, -7 * s);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(-3.2 * s, -1 * s);
    g.lineTo(-4 * s, 2 * s * crouch);
    g.stroke();
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(4 * s, 2 * s * crouch);
    g.stroke();
  }
  // head
  g.fillStyle = "#f2c396";
  g.fillRect(-2.6 * s, -6.5 * s * crouch, 5.2 * s, 5 * s * crouch);
  g.restore();
}

function hullPath(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  g.moveTo(-w / 2 + h * 0.4, -h / 2);
  g.lineTo(w / 2 - h * 0.4, -h / 2);
  g.quadraticCurveTo(w / 2, -h / 2, w / 2, 0);
  g.quadraticCurveTo(w / 2, h / 2, w / 2 - h * 0.5, h / 2);
  g.lineTo(-w / 2 + h * 0.5, h / 2);
  g.quadraticCurveTo(-w / 2, h / 2, -w / 2, 0);
  g.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + h * 0.4, -h / 2);
  g.closePath();
}

export type BoatDraw = {
  shipId: ShipId;
  cells: { x: number; y: number }[];
  tier: DamageTier;
};

/** One boat, oriented along its cells, with a crew figure and damage state. */
export function drawBoat(g: CanvasRenderingContext2D, boat: BoatDraw, t: number, showCrew: boolean) {
  const xs = boat.cells.map((c) => c.x);
  const ys = boat.cells.map((c) => c.y);
  const horizontal = Math.max(...xs) > Math.min(...xs);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const len = boat.cells.length;
  const cx = (minX + (horizontal ? len : 1) / 2) * CELL;
  const cy = (minY + (horizontal ? 1 : len) / 2) * CELL;
  const w = (horizontal ? len : 1) * CELL - 6;
  const h = (horizontal ? 1 : len) * CELL - 6;
  const long = Math.max(w, h);
  const short = Math.min(w, h);

  const palette = BOAT_COLOR[boat.shipId];
  const disabled = boat.tier === "disabled";
  const tilt = boat.tier === "critical" ? Math.sin(t * 3) * 0.05 : boat.tier === "damaged" ? Math.sin(t * 2) * 0.02 : 0;
  const sit = disabled ? 3 : boat.tier === "critical" ? 1.4 : 0;

  g.save();
  g.translate(cx, cy);
  if (!horizontal) g.rotate(Math.PI / 2);
  g.rotate(tilt);
  g.translate(0, sit);

  // wake
  if (!disabled) {
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(0, short * 0.5, long * 0.42, short * 0.28, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  hullPath(g, long, short);
  g.fillStyle = disabled ? "rgba(90,95,105,0.7)" : palette.hull;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 1.4;
  g.stroke();

  // deckhouse
  g.fillStyle = disabled ? "rgba(60,64,72,0.8)" : palette.deck;
  g.fillRect(-long * 0.14, -short * 0.28, long * 0.28, short * 0.56);

  // smoke on damaged/critical/disabled
  if (boat.tier !== "healthy") {
    const puffs = boat.tier === "disabled" ? 4 : boat.tier === "critical" ? 3 : 1;
    for (let i = 0; i < puffs; i++) {
      const life = (t * 0.6 + i * 0.35) % 1;
      g.save();
      g.globalAlpha = 0.28 * (1 - life);
      g.fillStyle = "#5b5f68";
      g.beginPath();
      g.arc(0, -short * 0.4 - life * 16, 3 + life * 6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.restore();

  if (showCrew && !disabled) {
    const pose = boat.tier === "critical" ? "duck" : "idle";
    crew(g, cx, cy - short * 0.05, Math.max(1.1, CELL * 0.09), pose, t, minX + minY);
  }
}

export type FxKind = "splash" | "hit" | "sonarClear" | "sonarFound";
export type Fx = { kind: FxKind; x: number; y: number; start: number };

export function drawFx(g: CanvasRenderingContext2D, fx: Fx, now: number) {
  const age = now - fx.start;
  const { x, y } = toPx(fx.x + 0.5, fx.y + 0.5);
  if (fx.kind === "splash") {
    const life = Math.min(1, age / 0.6);
    g.save();
    g.globalAlpha = 1 - life;
    g.strokeStyle = "#e8f6ff";
    g.lineWidth = 2;
    for (let r = 0; r < 2; r++) {
      g.beginPath();
      g.arc(x, y, 4 + life * (14 + r * 8), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const d = life * 12;
      g.beginPath();
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - life * 10, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else if (fx.kind === "hit") {
    const life = Math.min(1, age / 0.7);
    g.save();
    g.globalAlpha = 1 - life;
    g.strokeStyle = "#ffe1c9";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, 5 + life * 18, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#c0492e";
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(90,95,105,0.7)";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x - 4 + i * 4, y - 6 - life * 14, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else {
    const life = Math.min(1, age / 1.1);
    const color = fx.kind === "sonarFound" ? "255,209,102" : "150,220,255";
    g.save();
    g.globalAlpha = 0.9 * (1 - life);
    g.strokeStyle = `rgba(${color},1)`;
    g.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      g.beginPath();
      g.arc(x, y, CELL * 0.7 + life * 20 + r * 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
}

export function drawProjectile(g: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const { x: tx, y: ty } = toPx(x + 0.5, y + 0.5);
  const startY = -20;
  const py = startY + (ty - startY) * progress;
  const px = tx;
  const arc = Math.sin(progress * Math.PI) * -26;
  g.save();
  g.fillStyle = "#2b2140";
  g.beginPath();
  g.arc(px, py + arc, 3.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(px, py + arc);
  g.lineTo(px - 2, py + arc + 8);
  g.stroke();
  g.restore();
}

export function drawReticle(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const { x: px, y: py } = toPx(x + 0.5, y + 0.5);
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  g.save();
  g.strokeStyle = "#FFD166";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px, py, CELL * 0.42 * pulse, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(px - CELL * 0.55, py);
  g.lineTo(px - CELL * 0.3, py);
  g.moveTo(px + CELL * 0.3, py);
  g.lineTo(px + CELL * 0.55, py);
  g.moveTo(px, py - CELL * 0.55);
  g.lineTo(px, py - CELL * 0.3);
  g.moveTo(px, py + CELL * 0.3);
  g.lineTo(px, py + CELL * 0.55);
  g.stroke();
  g.restore();
}
