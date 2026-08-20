/**
 * YAJ Tower Escape — level data (Phase 1: ONE complete tower).
 *
 * World space: x grows right, y grows UP from the lobby floor (y = 0).
 * The player travels through this world with a real world position; the camera
 * follows them. Nothing here scrolls "at" a stationary player.
 */

export type SectionTheme = "lobby" | "industrial" | "neon" | "glass" | "shaft" | "construction" | "sky";

export type Section = {
  id: string;
  name: string;
  theme: SectionTheme;
  /** World y where the section starts (inclusive) and ends. */
  from: number;
  to: number;
};

export type PlatformKind =
  | "solid"
  | "mover" // moves in world space, carries the player
  | "blink" // timed gate: appears / disappears on a cycle
  | "fall" // collapses shortly after being stood on, then rebuilds
  | "elevator" // long vertical travel
  | "conveyor" // pushes the player sideways
  | "bounce"; // bouncing pad

export type Platform = {
  id: string;
  kind: PlatformKind;
  x: number;
  y: number; // bottom edge
  w: number;
  h: number;
  /** mover / elevator motion */
  axis?: "x" | "y";
  amp?: number;
  /** cycles per second */
  speed?: number;
  phase?: number;
  /** conveyor direction / bounce strength */
  dir?: number;
  power?: number;
  /** blink cycle in seconds: on for `on`, off for `off` */
  on?: number;
  off?: number;
};

export type HazardKind = "laser" | "spikes" | "block" | "crate" | "bar";

export type Hazard = {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  axis?: "x" | "y";
  amp?: number;
  speed?: number;
  phase?: number;
  /** laser blink timing */
  on?: number;
  off?: number;
  /** rotating bar length + rate */
  len?: number;
  rate?: number;
};

export type Climb = { id: string; x: number; y: number; w: number; h: number };
export type Star = { id: string; x: number; y: number; bonus?: boolean };
export type PowerKind = "shield" | "double" | "speed";
export type PowerUp = { id: string; kind: PowerKind; x: number; y: number };
export type Checkpoint = { id: string; index: number; x: number; y: number };

export type TowerLevel = {
  seed: string;
  width: number;
  top: number;
  spawn: { x: number; y: number };
  finish: { x: number; y: number; w: number; h: number };
  sections: Section[];
  platforms: Platform[];
  hazards: Hazard[];
  climbs: Climb[];
  stars: Star[];
  powerups: PowerUp[];
  checkpoints: Checkpoint[];
};

const W = 720;

let n = 0;
const uid = (p: string) => `${p}${++n}`;

const solid = (x: number, y: number, w: number, h = 22, kind: PlatformKind = "solid", extra: Partial<Platform> = {}): Platform => ({
  id: uid("p"),
  kind,
  x,
  y,
  w,
  h,
  ...extra,
});

const star = (x: number, y: number, bonus = false): Star => ({ id: uid("s"), x, y, bonus });

/** The tower is authored by hand, section by section, so each floor reads differently. */
export function buildTower(): TowerLevel {
  n = 0;
  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const climbs: Climb[] = [];
  const stars: Star[] = [];
  const powerups: PowerUp[] = [];
  const checkpoints: Checkpoint[] = [];

  // ── 1. GROUND FLOOR / LOBBY ────────────────────────────────────────────────
  platforms.push(solid(20, 0, 680, 44));
  platforms.push(solid(70, 170, 150));
  platforms.push(solid(320, 290, 130));
  platforms.push(solid(540, 400, 150));
  platforms.push(solid(300, 520, 130));
  platforms.push(solid(60, 640, 160));
  stars.push(star(140, 230), star(380, 350), star(610, 460), star(120, 700));
  checkpoints.push({ id: uid("c"), index: 1, x: 110, y: 662 });

  // ── 2. MOVING PLATFORM ROOM ────────────────────────────────────────────────
  platforms.push(solid(220, 760, 110, 20, "mover", { axis: "x", amp: 150, speed: 0.28 }));
  platforms.push(solid(520, 860, 110, 20, "mover", { axis: "y", amp: 110, speed: 0.32, phase: 0.4 }));
  platforms.push(solid(260, 990, 110, 20, "mover", { axis: "x", amp: 190, speed: 0.34, phase: 0.6 }));
  platforms.push(solid(60, 1100, 130));
  platforms.push(solid(420, 1200, 120, 20, "mover", { axis: "x", amp: 160, speed: 0.4, phase: 0.2 }));
  platforms.push(solid(120, 1320, 120, 20, "mover", { axis: "y", amp: 130, speed: 0.3 }));
  platforms.push(solid(430, 1440, 140));
  hazards.push({ id: uid("h"), kind: "block", x: 250, y: 1120, w: 60, h: 60, axis: "x", amp: 170, speed: 0.45 });
  stars.push(star(300, 830), star(575, 960), star(120, 1170), star(490, 1270), star(500, 1510));
  powerups.push({ id: uid("u"), kind: "shield", x: 120, y: 1420 });
  platforms.push(solid(440, 1560, 200));
  checkpoints.push({ id: uid("c"), index: 2, x: 520, y: 1582 });

  // ── 3. LASER / TIMING HALL ────────────────────────────────────────────────
  platforms.push(solid(180, 1690, 160));
  platforms.push(solid(430, 1690, 160));
  hazards.push({ id: uid("h"), kind: "laser", x: 60, y: 1740, w: 600, h: 12, on: 1.5, off: 1.2 });
  platforms.push(solid(90, 1810, 140));
  platforms.push(solid(340, 1880, 120, 20, "blink", { on: 2.1, off: 1.3 }));
  platforms.push(solid(540, 1950, 140));
  hazards.push({ id: uid("h"), kind: "laser", x: 60, y: 1900, w: 460, h: 12, on: 1.2, off: 1.5, phase: 0.7 });
  platforms.push(solid(300, 2050, 120, 20, "blink", { on: 1.8, off: 1.1, phase: 0.9 }));
  platforms.push(solid(80, 2140, 150));
  hazards.push({ id: uid("h"), kind: "laser", x: 240, y: 2185, w: 440, h: 12, on: 1.4, off: 1.4, phase: 0.3 });
  // Route choice: LEFT is the safe stair, RIGHT is a laser gauntlet worth extra stars.
  platforms.push(solid(60, 2260, 130));
  platforms.push(solid(230, 2350, 120));
  platforms.push(solid(470, 2246, 90, 18, "blink", { on: 1.4, off: 1.0 }));
  platforms.push(solid(600, 2350, 90, 18, "blink", { on: 1.4, off: 1.0, phase: 0.7 }));
  hazards.push({ id: uid("h"), kind: "block", x: 520, y: 2300, w: 48, h: 48, axis: "y", amp: 90, speed: 0.6 });
  stars.push(star(250, 1760), star(160, 1870), star(400, 1950), star(600, 2020), star(140, 2210));
  stars.push(star(510, 2330, true), star(645, 2410, true), star(560, 2470, true));
  platforms.push(solid(220, 2460, 300));
  checkpoints.push({ id: uid("c"), index: 3, x: 300, y: 2482 });

  // ── 4. FALLING FLOOR SECTION ──────────────────────────────────────────────
  const fallRow = (y: number, xs: number[]) => xs.forEach((x) => platforms.push(solid(x, y, 96, 18, "fall")));
  fallRow(2580, [120, 300, 480]);
  fallRow(2700, [200, 400, 580]);
  fallRow(2820, [90, 280, 470]);
  fallRow(2940, [200, 390, 560]);
  hazards.push({ id: uid("h"), kind: "crate", x: 330, y: 3100, w: 54, h: 54, axis: "y", amp: 260, speed: 0.42 });
  hazards.push({ id: uid("h"), kind: "crate", x: 560, y: 3100, w: 54, h: 54, axis: "y", amp: 260, speed: 0.42, phase: 0.5 });
  platforms.push(solid(60, 3060, 150));
  fallRow(3160, [250, 398]);
  platforms.push(solid(560, 3250, 130));
  platforms.push(solid(300, 3340, 120, 20, "bounce", { power: 1.45 }));
  stars.push(star(340, 2650), star(240, 2760), star(320, 2880), star(240, 3000), star(300, 3220));
  powerups.push({ id: uid("u"), kind: "double", x: 620, y: 3300 });
  platforms.push(solid(120, 3430, 260));
  checkpoints.push({ id: uid("c"), index: 4, x: 200, y: 3452 });

  // ── 5. ELEVATOR SHAFT ─────────────────────────────────────────────────────
  platforms.push(solid(80, 3560, 110, 20, "elevator", { axis: "y", amp: 260, speed: 0.17 }));
  platforms.push(solid(300, 3620, 110, 20, "elevator", { axis: "y", amp: 300, speed: 0.15, phase: 0.5 }));
  platforms.push(solid(520, 3560, 110, 20, "elevator", { axis: "y", amp: 280, speed: 0.19, phase: 0.25 }));
  hazards.push({ id: uid("h"), kind: "bar", x: 360, y: 3900, w: 16, h: 16, len: 130, rate: 0.55 });
  platforms.push(solid(60, 4020, 170, 20, "conveyor", { dir: 1 }));
  platforms.push(solid(430, 4020, 170, 20, "conveyor", { dir: -1 }));
  hazards.push({ id: uid("h"), kind: "spikes", x: 250, y: 4020, w: 160, h: 18 });
  platforms.push(solid(220, 4130, 120, 20, "mover", { axis: "y", amp: 120, speed: 0.28 }));
  platforms.push(solid(470, 4230, 150));
  hazards.push({ id: uid("h"), kind: "bar", x: 200, y: 4260, w: 16, h: 16, len: 110, rate: -0.7 });
  platforms.push(solid(60, 4320, 150));
  stars.push(star(130, 3760), star(350, 3820), star(575, 3760), star(140, 4080), star(510, 4300));
  powerups.push({ id: uid("u"), kind: "speed", x: 300, y: 4200 });
  platforms.push(solid(230, 4420, 260));
  checkpoints.push({ id: uid("c"), index: 5, x: 310, y: 4442 });

  // ── 6. ROOFTOP CONSTRUCTION AREA ──────────────────────────────────────────
  platforms.push(solid(90, 4540, 140, 18));
  hazards.push({ id: uid("h"), kind: "block", x: 300, y: 4560, w: 56, h: 56, axis: "x", amp: 200, speed: 0.5 });
  platforms.push(solid(420, 4620, 140, 18));
  platforms.push(solid(180, 4720, 120, 18, "mover", { axis: "x", amp: 150, speed: 0.36 }));
  platforms.push(solid(520, 4820, 140, 18));
  hazards.push({ id: uid("h"), kind: "crate", x: 250, y: 4980, w: 54, h: 54, axis: "y", amp: 200, speed: 0.5 });
  platforms.push(solid(80, 4900, 150, 18));
  platforms.push(solid(330, 4990, 120, 20, "bounce", { power: 1.5 }));
  // Route choice: LEFT scaffold ladder is calmer, RIGHT beams carry bonus stars.
  climbs.push({ id: uid("l"), x: 96, y: 4918, w: 26, h: 300 });
  platforms.push(solid(60, 5210, 150, 18));
  platforms.push(solid(470, 5090, 100, 18, "mover", { axis: "y", amp: 110, speed: 0.4 }));
  platforms.push(solid(600, 5190, 100, 18));
  stars.push(star(150, 4600), star(480, 4680), star(240, 4790), star(580, 4880), star(140, 4960));
  stars.push(star(510, 5150, true), star(645, 5250, true));
  platforms.push(solid(230, 5300, 260, 20));
  checkpoints.push({ id: uid("c"), index: 6, x: 310, y: 5322 });

  // ── 7. FINAL CLIMB → ROOFTOP ──────────────────────────────────────────────
  climbs.push({ id: uid("l"), x: 344, y: 5320, w: 28, h: 240 });
  platforms.push(solid(250, 5560, 220, 18));
  hazards.push({ id: uid("h"), kind: "laser", x: 60, y: 5620, w: 600, h: 12, on: 1.0, off: 1.0 });
  platforms.push(solid(120, 5680, 120, 18, "mover", { axis: "x", amp: 130, speed: 0.42 }));
  platforms.push(solid(430, 5760, 120, 18, "mover", { axis: "x", amp: 130, speed: 0.42, phase: 0.5 }));
  platforms.push(solid(240, 5880, 240, 20));
  stars.push(star(360, 5450), star(170, 5740), star(500, 5830), star(360, 5940));
  platforms.push(solid(40, 6000, 640, 40));

  const sections: Section[] = [
    { id: "lobby", name: "Lobby", theme: "lobby", from: 0, to: 740 },
    { id: "movers", name: "Maintenance Floor", theme: "industrial", from: 740, to: 1670 },
    { id: "lasers", name: "Neon Timing Hall", theme: "neon", from: 1670, to: 2560 },
    { id: "falling", name: "Glass Skybridge", theme: "glass", from: 2560, to: 3540 },
    { id: "shaft", name: "Elevator Shaft", theme: "shaft", from: 3540, to: 4520 },
    { id: "construction", name: "Rooftop Construction", theme: "construction", from: 4520, to: 5400 },
    { id: "final", name: "Final Climb", theme: "sky", from: 5400, to: 6100 },
  ];

  return {
    seed: "yaj-tower-01",
    width: W,
    top: 6100,
    spawn: { x: 90, y: 44 },
    finish: { x: 280, y: 6040, w: 160, h: 90 },
    sections,
    platforms,
    hazards,
    climbs,
    stars,
    powerups,
    checkpoints,
  };
}

export const TOWER_WIDTH = W;
export const TOTAL_CHECKPOINTS = 6;
