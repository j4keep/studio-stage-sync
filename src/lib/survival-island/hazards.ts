/**
 * Modular hazard definitions for YAJ Survival Island.
 *
 * Every hazard is spawned from a seeded RNG stream so the same seed always produces
 * the same hazard sequence — that is what a future "Last One Standing" mode or an
 * asynchronous friend challenge will synchronise on.
 */

import { GRID_W, IslandMap, TILE, idx, tileCenter, walkable } from "./map";

export type HazardKind = "coconut" | "crate";

export type ImpactHazard = {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  radius: number;
  /** Seconds of ground warning left before impact. */
  warn: number;
  /** Seconds since impact (used for the smash animation / crate linger). */
  age: number;
  impacted: boolean;
  /** Crates stay as an obstacle for a while after landing. */
  linger: number;
  hitPlayer: boolean;
};

export type Flood = {
  active: boolean;
  /** Everything with elevation <= level is unsafe. */
  level: number;
  phase: "warn" | "rising" | "hold" | "receding";
  t: number;
  /** 0..1 visual rise progress. */
  rise: number;
};

export type Wind = {
  active: boolean;
  dx: number;
  dy: number;
  strength: number;
  t: number;
};

export type Collapse = {
  active: boolean;
  tiles: number[];
  phase: "warn" | "out";
  t: number;
};

export type WaveDef = { n: number; name: string; sub: string };

export const WAVES: WaveDef[] = [
  { n: 1, name: "Wave 1", sub: "Falling Coconuts" },
  { n: 2, name: "Wave 2", sub: "Rising Water" },
  { n: 3, name: "Wave 3", sub: "Strong Winds" },
  { n: 4, name: "Wave 4", sub: "Falling Crates" },
  { n: 5, name: "Wave 5", sub: "Everything At Once" },
];

export const WAVE_MS = 30_000;
export const MAX_ACTIVE_HAZARDS = 14;

export function waveFor(elapsedMs: number) {
  return Math.min(WAVES.length, Math.floor(elapsedMs / WAVE_MS) + 1);
}

/** Coconut cadence tightens with the wave but never becomes a wall of hazards. */
export function coconutInterval(wave: number) {
  return Math.max(0.85, 2.6 - wave * 0.3);
}

export function crateInterval(wave: number) {
  return wave >= 4 ? Math.max(1.6, 3.6 - (wave - 4) * 0.8) : Infinity;
}

let nextId = 1;

/** Coconuts land near palms — readable, and always leaves open ground to step to. */
export function spawnCoconut(map: IslandMap, rnd: () => number, near?: { x: number; y: number }): ImpactHazard {
  const spot =
    near && rnd() < 0.55
      ? jitter(near, TILE * 2.4, rnd)
      : map.coconutSpots[Math.floor(rnd() * map.coconutSpots.length)] ?? map.plaza;
  return {
    id: nextId++,
    kind: "coconut",
    x: clampWorld(spot.x),
    y: clampWorld(spot.y),
    radius: 30,
    warn: 1.05,
    age: 0,
    impacted: false,
    linger: 0,
    hitPlayer: false,
  };
}

/** Crates drop on open ground and stay as a temporary obstacle. */
export function spawnCrate(
  map: IslandMap,
  rnd: () => number,
  collapsed: Set<number>,
  near?: { x: number; y: number },
): ImpactHazard | null {
  for (let n = 0; n < 30; n++) {
    const base = near && rnd() < 0.5 ? jitter(near, TILE * 3.2, rnd) : randomLandPoint(map, rnd);
    if (!base) continue;
    if (!walkable(map, base.x, base.y, collapsed)) continue;
    return {
      id: nextId++,
      kind: "crate",
      x: clampWorld(base.x),
      y: clampWorld(base.y),
      radius: 34,
      warn: 1.25,
      age: 0,
      impacted: false,
      linger: 7,
      hitPlayer: false,
    };
  }
  return null;
}

export function startFlood(level: number): Flood {
  return { active: true, level, phase: "warn", t: 0, rise: 0 };
}

export function startWind(rnd: () => number, wave: number): Wind {
  const a = rnd() * Math.PI * 2;
  return {
    active: true,
    dx: Math.cos(a),
    dy: Math.sin(a) * 0.7,
    strength: 120 + wave * 22,
    t: 0,
  };
}

export function startCollapse(map: IslandMap, rnd: () => number): Collapse | null {
  if (!map.bridgeTiles.length) return null;
  const pick = map.bridgeTiles.filter(() => rnd() < 0.6);
  const tiles = pick.length ? pick : map.bridgeTiles.slice(0, 4);
  return { active: true, tiles, phase: "warn", t: 0 };
}

export function collapseTilePoints(tiles: number[]) {
  return tiles.map((i) => tileCenter(i % GRID_W, Math.floor(i / GRID_W)));
}

export function bridgeTileIndex(x: number, y: number) {
  return idx(Math.floor(x / TILE), Math.floor(y / TILE));
}

function jitter(p: { x: number; y: number }, r: number, rnd: () => number) {
  return { x: p.x + (rnd() - 0.5) * r * 2, y: p.y + (rnd() - 0.5) * r * 2 };
}

function randomLandPoint(map: IslandMap, rnd: () => number) {
  for (let n = 0; n < 40; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * 26);
    const t = map.tiles[idx(tx, ty)];
    if (t === "water") continue;
    return tileCenter(tx, ty);
  }
  return null;
}

function clampWorld(v: number) {
  return Math.max(TILE, Math.min(v, GRID_W * TILE - TILE));
}
