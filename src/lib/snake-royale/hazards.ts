/**
 * Modular hazard definitions for YAJ Snake Royale.
 *
 * Three hazard archetypes cover everything the jungle throws at the player:
 *  - SnakeHazard: den-anchored wander/strike state machine — the only hazard that
 *    actually moves and reacts to the player, spawned from a bush/log/rock/water-edge
 *    den spot on the map.
 *  - ImpactHazard: rolling rocks + falling branches, identical warn-then-impact shape
 *    (ground telegraph, then a hit/dodge resolution) — just a reskinned version of the
 *    same mechanic, spawned from the map's slope/canopy spots.
 *  - Static zone checks (mud slow, croc-water/thorn-bush tick damage) are plain terrain
 *    lookups against the map, not spawned objects — see engine.ts's tickZones().
 *
 * Every hazard is spawned from a seeded RNG stream so the same seed always produces the
 * same hazard sequence, matching the convention already used for Survival Island.
 */

import { DenKind, DenSpot, GRID_H, GRID_W, JungleMap, TILE, idx, tileCenter } from "./map";

/** A den with no snake in this array is simply "hidden" — there's no idle placeholder
 *  object; tickDens() in engine.ts decides when to spawn one straight into "emerging". */
export type SnakeState = "emerging" | "active" | "striking" | "retreating";

export type SnakeHazard = {
  id: number;
  denIndex: number;
  denX: number;
  denY: number;
  denKind: DenKind;
  x: number;
  y: number;
  angle: number;
  state: SnakeState;
  /** Seconds spent in the current state. */
  t: number;
  wanderTx: number;
  wanderTy: number;
  /** Seconds until this den may spawn another snake, once this one retreats. */
  cooldown: number;
  hitPlayer: boolean;
};

export type ImpactKind = "rock" | "branch";

export type ImpactHazard = {
  id: number;
  kind: ImpactKind;
  x: number;
  y: number;
  radius: number;
  /** Seconds of ground warning left before impact. */
  warn: number;
  /** Seconds since impact (used for the smash animation / linger). */
  age: number;
  impacted: boolean;
  linger: number;
  hitPlayer: boolean;
};

export type WaveDef = { n: number; name: string; sub: string };

export const WAVES: WaveDef[] = [
  { n: 1, name: "Wave 1", sub: "Rustling Grass" },
  { n: 2, name: "Wave 2", sub: "River Crossing" },
  { n: 3, name: "Wave 3", sub: "Falling Branches" },
  { n: 4, name: "Wave 4", sub: "Rolling Rocks" },
  { n: 5, name: "Wave 5", sub: "Full Jungle Fury" },
];

export const WAVE_MS = 28_000;
export const MAX_ACTIVE_SNAKES = 6;
export const MAX_ACTIVE_IMPACTS = 8;

// Snake state-machine timing.
export const EMERGE_DURATION = 0.45;
export const WANDER_RADIUS = 60;
export const DEN_AWARENESS_RANGE = 230;
export const STRIKE_RANGE = 68;
export const STRIKE_LOSE_RANGE = 150;
export const STRIKE_WINDUP = 0.38;
export const STRIKE_LUNGE = 0.26;
export const RETREAT_DURATION = 0.55;
export const SNAKE_R = 16;

export function waveFor(elapsedMs: number) {
  return Math.min(WAVES.length, Math.floor(elapsedMs / WAVE_MS) + 1);
}

/** More dens active + shorter den cooldown as waves climb, capped so it stays fair. */
export function denCooldown(wave: number, rnd: () => number) {
  const base = Math.max(2.2, 6.5 - wave * 0.7);
  return base + rnd() * 2;
}

export function rockInterval(wave: number) {
  return wave >= 4 ? Math.max(1.8, 4.2 - (wave - 4) * 1.1) : Infinity;
}

export function branchInterval(wave: number) {
  return wave >= 3 ? Math.max(1.5, 3.4 - (wave - 3) * 0.6) : Infinity;
}

let nextSnakeId = 1;
let nextImpactId = 1;

export function spawnSnake(den: DenSpot, denIndex: number): SnakeHazard {
  return {
    id: nextSnakeId++,
    denIndex,
    denX: den.x,
    denY: den.y,
    denKind: den.kind,
    x: den.x,
    y: den.y,
    angle: 0,
    state: "emerging",
    t: 0,
    wanderTx: den.x,
    wanderTy: den.y,
    cooldown: 0,
    hitPlayer: false,
  };
}

/** Rocks roll down from the rocky slope; branches fall from canopy trees. Both use the
 *  same warn-then-impact shape as Survival Island's coconuts/crates. */
export function spawnImpact(map: JungleMap, kind: ImpactKind, rnd: () => number): ImpactHazard | null {
  const spots = kind === "rock" ? map.slopeSpots : map.canopySpots;
  if (!spots.length) return null;
  const spot = spots[Math.floor(rnd() * spots.length)];
  return {
    id: nextImpactId++,
    kind,
    x: spot.x + (rnd() - 0.5) * TILE,
    y: spot.y + (rnd() - 0.5) * TILE,
    radius: kind === "rock" ? 26 : 24,
    warn: kind === "rock" ? 1.1 : 0.9,
    age: 0,
    impacted: false,
    linger: 0,
    hitPlayer: false,
  };
}

export function isMud(map: JungleMap, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
  return map.tiles[idx(tx, ty)] === "mud";
}

export function isCrocWater(map: JungleMap, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return true;
  return map.tiles[idx(tx, ty)] === "shallow";
}

export { tileCenter };
