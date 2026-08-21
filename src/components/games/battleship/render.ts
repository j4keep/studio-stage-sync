/**
 * YAJ Fleet Clash — ONE continuous ocean battlefield, not two stacked boards. A hazy enemy
 * horizon at the top and your own clear home waters at the bottom share a single canvas, with
 * open water and reef in between where shots physically travel between the two fleets. The
 * hidden 10x10 grids from src/lib/battleship.ts still back both halves — this module only maps
 * each side's grid cells onto its own band of one continuous scene and back again for taps.
 *
 * Flat 2D canvas throughout (no 3D engine): two zones need to render live at once, and characters
 * are drawn as small blocky sprites in the same visual language as the rest of YAJ Adventures.
 */

import { BOARD_SIZE, Fleet, ShipId } from "@/lib/battleship";

export const VIEW_W = 340;
export const ENEMY_H = 230;
export const DMZ_H = 66;
export const PLAYER_TOP = ENEMY_H + DMZ_H;
export const PLAYER_H = 316;
export const VIEW_H = PLAYER_TOP + PLAYER_H;

const CELL_X = VIEW_W / BOARD_SIZE;
const ENEMY_CELL_Y = ENEMY_H / BOARD_SIZE;
const PLAYER_CELL_Y = PLAYER_H / BOARD_SIZE;

export type Band = "enemy" | "player";
export type DamageTier = "healthy" | "damaged" | "critical" | "disabled";

export function damageTier(hits: boolean[]): DamageTier {
  const taken = hits.filter(Boolean).length;
  if (taken === 0) return "healthy";
  if (taken === hits.length) return "disabled";
  if (taken >= hits.length - 1) return "critical";
  return "damaged";
}

export function toPx(band: Band, gx: number, gy: number) {
  if (band === "enemy") return { x: gx * CELL_X + CELL_X / 2, y: gy * ENEMY_CELL_Y + ENEMY_CELL_Y / 2 };
  return { x: gx * CELL_X + CELL_X / 2, y: PLAYER_TOP + gy * PLAYER_CELL_Y + PLAYER_CELL_Y / 2 };
}

export function cellFromPoint(px: number, py: number): { band: Band; x: number; y: number } | null {
  if (px < 0 || px >= VIEW_W) return null;
  if (py >= 0 && py < ENEMY_H) {
    return { band: "enemy", x: Math.floor(px / CELL_X), y: Math.floor(py / ENEMY_CELL_Y) };
  }
  if (py >= PLAYER_TOP && py < VIEW_H) {
    return { band: "player", x: Math.floor(px / CELL_X), y: Math.floor((py - PLAYER_TOP) / PLAYER_CELL_Y) };
  }
  return null;
}

const BOAT_COLOR: Record<ShipId, { hull: string; deck: string }> = {
  carrier: { hull: "#2FB6C4", deck: "#1c7d87" }, // Voyager
  battleship: { hull: "#6B3FA0", deck: "#472a6b" }, // Clipper
  cruiser: { hull: "#FF7A59", deck: "#c9573a" }, // Skimmer
  submarine: { hull: "#FFD166", deck: "#c9a13f" }, // Runner
  destroyer: { hull: "#7dd3a0", deck: "#4f9a6d" }, // Skiff
};

const ENEMY_ISLANDS = [
  { cx: 1.2, cy: 1.4, r: 0.85 },
  { cx: 8.5, cy: 2.2, r: 0.6 },
];
const PLAYER_ISLANDS = [
  { cx: 9, cy: 1.1, r: 0.95 },
  { cx: 0.5, cy: 8.3, r: 0.6 },
];
const REEF = [
  { x: 0.18, r: 16 },
  { x: 0.62, r: 12 },
  { x: 0.85, r: 14 },
];

function palm(g: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number) {
  g.save();
  g.strokeStyle = "#8a5a2b";
  g.lineWidth = 2.2 * s;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + 5 * s * sway, y - 12 * s, x + 8 * s * sway, y - 20 * s);
  g.stroke();
  const topX = x + 8 * s * sway;
  const topY = y - 20 * s;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 2.6) * i - Math.PI * 0.85;
    g.strokeStyle = i % 2 ? "#2f8f4d" : "#3fae5c";
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(topX, topY);
    g.quadraticCurveTo(topX + Math.cos(a) * 8 * s, topY + Math.sin(a) * 5 * s - 3 * s, topX + Math.cos(a) * 13 * s, topY + Math.sin(a) * 8 * s + 2 * s);
    g.stroke();
  }
  g.restore();
}

function island(g: CanvasRenderingContext2D, band: Band, cx: number, cy: number, r: number, t: number, hazy: boolean) {
  const { x, y } = toPx(band, cx, cy);
  const cellY = band === "enemy" ? ENEMY_CELL_Y : PLAYER_CELL_Y;
  const px = r * Math.min(CELL_X, cellY) * 2.2;
  g.save();
  if (hazy) g.globalAlpha = 0.72;
  const halo = g.createRadialGradient(x, y, px * 0.6, x, y, px * 1.6);
  halo.addColorStop(0, "rgba(255,255,255,0.24)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, px * 1.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e8d4a0";
  g.beginPath();
  g.arc(x, y, px, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6fbf6f";
  g.beginPath();
  g.arc(x - px * 0.1, y - px * 0.15, px * 0.7, 0, Math.PI * 2);
  g.fill();
  palm(g, x - px * 0.12, y - px * 0.05, Math.max(0.5, px * 0.05), Math.sin(t * 1.1) * 0.4);
  g.restore();
}

function reef(g: CanvasRenderingContext2D, xFrac: number, r: number, t: number) {
  const x = xFrac * VIEW_W;
  const y = ENEMY_H + DMZ_H / 2 + Math.sin(t * 0.6 + xFrac * 8) * 4;
  g.save();
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.beginPath();
  g.arc(x, y, r * 1.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8a94a3";
  g.beginPath();
  g.moveTo(x - r, y + r * 0.4);
  g.lineTo(x - r * 0.5, y - r);
  g.lineTo(x + r * 0.3, y - r * 0.8);
  g.lineTo(x + r, y + r * 0.2);
  g.lineTo(x + r * 0.5, y + r * 0.5);
  g.closePath();
  g.fill();
  g.restore();
}

/** The whole ocean scene, one continuous surface — draw first, every frame. */
export function drawScene(g: CanvasRenderingContext2D, t: number) {
  const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "hsl(204 55% 20%)");
  sky.addColorStop(0.36, "hsl(200 60% 32%)");
  sky.addColorStop(0.42, "hsl(198 62% 40%)");
  sky.addColorStop(1, "hsl(204 58% 26%)");
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  // waves — continuous across the whole scene, not per-band
  g.save();
  g.globalAlpha = 0.1;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1.3;
  for (let i = 0; i < 11; i++) {
    const yy = ((t * 20 + i * 46) % (VIEW_H + 60)) - 30;
    g.beginPath();
    g.moveTo(0, yy);
    for (let x = 0; x <= VIEW_W; x += 14) g.lineTo(x, yy + Math.sin(x * 0.06 + t * 1.5 + i) * 3.5);
    g.stroke();
  }
  g.restore();

  // haze over the far/enemy horizon — depth cue, not a border
  const haze = g.createLinearGradient(0, 0, 0, ENEMY_H + 40);
  haze.addColorStop(0, "rgba(180,210,230,0.16)");
  haze.addColorStop(1, "rgba(180,210,230,0)");
  g.fillStyle = haze;
  g.fillRect(0, 0, VIEW_W, ENEMY_H + 40);

  ENEMY_ISLANDS.forEach((isl) => island(g, "enemy", isl.cx, isl.cy, isl.r, t, true));
  REEF.forEach((r) => reef(g, r.x, r.r, t));
  PLAYER_ISLANDS.forEach((isl) => island(g, "player", isl.cx, isl.cy, isl.r, t, false));

  // very faint sector seams — present for orientation, never the focal element
  g.save();
  g.globalAlpha = 0.045;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1;
  for (let i = 2; i < BOARD_SIZE; i += 2) {
    const x = i * CELL_X;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, VIEW_H);
    g.stroke();
  }
  g.restore();
}

/** A standalone crew reaction at a specific grid cell, unattached to any boat — used for the
 *  brief "enemy crew reacts" flash at a hit cell without revealing the rest of their boat. */
export function drawCrewFlash(g: CanvasRenderingContext2D, band: Band, x: number, y: number, t: number, seed: number) {
  const { x: px, y: py } = toPx(band, x + 0.5, y + 0.5);
  const s = Math.min(CELL_X, band === "enemy" ? ENEMY_CELL_Y : PLAYER_CELL_Y) * 0.11;
  crew(g, px, py, s, "duck", t, seed);
}

function crew(g: CanvasRenderingContext2D, x: number, y: number, s: number, pose: "idle" | "duck" | "wave" | "celebrate" | "aim", t: number, seed: number) {
  g.save();
  g.translate(x, y);
  const bob = Math.sin(t * 2.4 + seed) * 0.6;
  g.translate(0, pose === "duck" ? 2.5 * s : bob);
  const crouch = pose === "duck" ? 0.6 : 1;
  g.fillStyle = "#2c3350";
  g.fillRect(-3 * s, 3 * s * crouch, 2.4 * s, 4 * s * crouch);
  g.fillRect(0.6 * s, 3 * s * crouch, 2.4 * s, 4 * s * crouch);
  g.fillStyle = "#6B3FA0";
  g.fillRect(-3.4 * s, -2 * s * crouch, 6.8 * s, 5.5 * s * crouch);
  g.strokeStyle = "#f2c396";
  g.lineWidth = 2 * s;
  g.lineCap = "round";
  if (pose === "wave") {
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(6 * s, -6 * s + Math.sin(t * 8) * 1.5 * s);
    g.stroke();
  } else if (pose === "aim") {
    // Two-handed aiming pose toward the enemy horizon.
    g.beginPath();
    g.moveTo(-3.2 * s, -1 * s);
    g.lineTo(0.6 * s, -4.4 * s);
    g.stroke();
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(1.4 * s, -4.8 * s);
    g.stroke();
    g.strokeStyle = "#2b2140";
    g.lineWidth = 1.25 * s;
    g.beginPath();
    g.moveTo(0.8 * s, -4.6 * s);
    g.lineTo(0.8 * s, -9.2 * s);
    g.stroke();
  } else if (pose === "celebrate") {
    g.beginPath();
    g.moveTo(-3.2 * s, -1 * s);
    g.lineTo(-5.5 * s, -7 * s + Math.sin(t * 10) * 1.2 * s);
    g.stroke();
    g.beginPath();
    g.moveTo(3.2 * s, -1 * s);
    g.lineTo(5.5 * s, -7 * s - Math.sin(t * 10) * 1.2 * s);
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

export type BoatDraw = { shipId: ShipId; cells: { x: number; y: number }[]; tier: DamageTier };

/** One boat, oriented along its cells, in a given band, with a crew figure and damage state. */
export function drawBoat(g: CanvasRenderingContext2D, band: Band, boat: BoatDraw, t: number, showCrew: boolean, pose: "idle" | "duck" | "celebrate" | "aim" = "idle") {
  const xs = boat.cells.map((c) => c.x);
  const ys = boat.cells.map((c) => c.y);
  const horizontal = Math.max(...xs) > Math.min(...xs);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const len = boat.cells.length;
  const cellY = band === "enemy" ? ENEMY_CELL_Y : PLAYER_CELL_Y;
  const cx = toPx(band, minX + (horizontal ? len : 1) / 2, 0).x;
  const cy = toPx(band, 0, minY + (horizontal ? 1 : len) / 2).y;
  const w = (horizontal ? len : 1) * CELL_X - 5;
  const h = (horizontal ? 1 : len) * cellY - 5;
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

  if (!disabled) {
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(0, short * 0.5, long * 0.4, short * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  hullPath(g, long, short);
  g.fillStyle = disabled ? "rgba(90,95,105,0.7)" : palette.hull;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 1.2;
  g.stroke();

  g.fillStyle = disabled ? "rgba(60,64,72,0.8)" : palette.deck;
  g.fillRect(-long * 0.14, -short * 0.28, long * 0.28, short * 0.56);

  if (boat.tier !== "healthy") {
    const puffs = boat.tier === "disabled" ? 3 : boat.tier === "critical" ? 2 : 1;
    for (let i = 0; i < puffs; i++) {
      const life = (t * 0.6 + i * 0.35) % 1;
      g.save();
      g.globalAlpha = 0.26 * (1 - life);
      g.fillStyle = "#5b5f68";
      g.beginPath();
      g.arc(0, -short * 0.4 - life * 14, 2.6 + life * 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.restore();

  if (showCrew && !disabled) {
    crew(g, cx, cy - short * 0.05, Math.max(1, Math.min(CELL_X, cellY) * 0.09), pose, t, minX + minY);
  }
}


/** A small visible attack boat used at the enemy horizon without revealing the hidden enemy fleet.
 * It gives the computer a real on-screen crew/launcher for its shot animation while preserving
 * the hidden-grid strategy underneath. */
export function drawAttackBoat(
  g: CanvasRenderingContext2D,
  side: "enemy" | "player",
  t: number,
  pose: "idle" | "aim" | "duck" | "celebrate" = "idle",
) {
  const cx = VIEW_W / 2;
  const cy = side === "enemy" ? 62 : PLAYER_TOP + PLAYER_H - 54;
  const long = 58;
  const short = 18;
  const enemy = side === "enemy";
  const bob = Math.sin(t * 1.8 + (enemy ? 1.7 : 0)) * 1.4;
  g.save();
  g.translate(cx, cy + bob);
  if (enemy) g.rotate(Math.PI);
  hullPath(g, long, short);
  g.fillStyle = enemy ? "#42536b" : "#6B3FA0";
  g.fill();
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = enemy ? "#2b3545" : "#472a6b";
  g.fillRect(-8, -5, 16, 10);
  // launcher barrel
  g.strokeStyle = enemy ? "#d4d8df" : "#f0d7ff";
  g.lineWidth = 2.2;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, -2);
  g.lineTo(0, -19);
  g.stroke();
  g.restore();
  crew(g, cx, cy + bob - 1, 1.25, pose, t, enemy ? 91 : 19);
}

export type FxKind = "splash" | "hit" | "sonarClear" | "sonarFound" | "muzzle";
export type Fx = { kind: FxKind; band: Band; x: number; y: number; start: number };

export function drawFx(g: CanvasRenderingContext2D, fx: Fx, now: number) {
  const age = now - fx.start;
  const { x, y } = toPx(fx.band, fx.x + 0.5, fx.y + 0.5);
  if (fx.kind === "splash") {
    const life = Math.min(1, age / 0.55);
    g.save();
    g.globalAlpha = (1 - life) * 0.8;
    g.strokeStyle = "#e8f6ff";
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x, y, 3 + life * 13, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  } else if (fx.kind === "hit") {
    const life = Math.min(1, age / 0.6);
    g.save();
    g.globalAlpha = (1 - life) * 0.9;
    g.strokeStyle = "#ffe1c9";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 4 + life * 15, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(90,95,105,0.6)";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x - 3 + i * 3, y - 5 - life * 12, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else if (fx.kind === "muzzle") {
    const life = Math.min(1, age / 0.35);
    g.save();
    g.globalAlpha = 1 - life;
    g.fillStyle = "#ffd9a0";
    g.beginPath();
    g.arc(x, y, 5 + life * 3, 0, Math.PI * 2);
    g.fill();
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
      g.arc(x, y, 14 + life * 20 + r * 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
}

/** A permanent-but-quiet record of a resolved shot — small and organic, deliberately NOT a
 *  crisp uniform icon, so a long game doesn't visually reconstitute a grid of markers. */
export function drawMark(g: CanvasRenderingContext2D, band: Band, x: number, y: number, kind: "hit" | "miss", seed: number) {
  const { x: cx, y: cy } = toPx(band, x + 0.5, y + 0.5);
  const wobble = Math.sin(seed * 12.9) * 2;
  g.save();
  if (kind === "miss") {
    g.globalAlpha = 0.22;
    g.fillStyle = "#0f2a3a";
    g.beginPath();
    g.ellipse(cx + wobble, cy, 5.5, 3.4, seed, 0, Math.PI * 2);
    g.fill();
  } else {
    g.globalAlpha = 0.75;
    g.fillStyle = "#b3492e";
    g.beginPath();
    g.arc(cx, cy, 3.4, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.5;
    g.strokeStyle = "#2c1a12";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx - 3, cy - 3 + wobble * 0.3);
    g.lineTo(cx + 3, cy + 3 - wobble * 0.3);
    g.stroke();
  }
  g.restore();
}

export function drawReticle(g: CanvasRenderingContext2D, band: Band, x: number, y: number, t: number, color = "#FFD166") {
  const { x: px, y: py } = toPx(band, x + 0.5, y + 0.5);
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  const r = Math.min(CELL_X, band === "enemy" ? ENEMY_CELL_Y : PLAYER_CELL_Y) * 0.42;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px, py, r * pulse, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(px - r * 1.3, py);
  g.lineTo(px - r * 0.7, py);
  g.moveTo(px + r * 0.7, py);
  g.lineTo(px + r * 1.3, py);
  g.moveTo(px, py - r * 1.3);
  g.lineTo(px, py - r * 0.7);
  g.moveTo(px, py + r * 0.7);
  g.lineTo(px, py + r * 1.3);
  g.stroke();
  g.restore();
}

/** A shot physically crossing the open water between the two fleets. */
export function drawProjectile(g: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, progress: number) {
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  const arc = -Math.sin(progress * Math.PI) * 30;
  g.save();
  g.fillStyle = "#2b2140";
  g.beginPath();
  g.arc(x, y + arc, 3.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 1.5;
  const trail = 10;
  const px = from.x + (to.x - from.x) * Math.max(0, progress - 0.06);
  const py = from.y + (to.y - from.y) * Math.max(0, progress - 0.06) - Math.sin(Math.max(0, progress - 0.06) * Math.PI) * 30;
  g.beginPath();
  g.moveTo(x, y + arc);
  g.lineTo(px, py);
  g.stroke();
  g.restore();
}
