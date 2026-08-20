/**
 * YAJ Survival Island — Sunset Island map (Phase 1, ONE polished map).
 *
 * The island is a tile grid in world units. Terrain carries an elevation used by the
 * rising-water hazard: anything at or below the current flood level is unsafe, which
 * gives the player a readable "run uphill" language (plaza / hill / rocks are safe).
 *
 * The map is generated from a seed so a future "Last One Standing" / friend challenge
 * mode can hand every player the exact same island.
 */

export type Terrain = "water" | "shallow" | "sand" | "grass" | "plaza" | "rock" | "hill" | "bridge" | "dock";

export const TILE = 44;
export const GRID_W = 40;
export const GRID_H = 30;
export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

/** Higher = safer from rising water. Water itself is not walkable. */
export const ELEVATION: Record<Terrain, number> = {
  water: -1,
  shallow: 0,
  sand: 1,
  dock: 1,
  bridge: 1,
  grass: 2,
  plaza: 3,
  rock: 4,
  hill: 5,
};

export type PropKind = "palm" | "hut" | "rock" | "campfire" | "barrel" | "sign";

export type IslandProp = {
  kind: PropKind;
  x: number;
  y: number;
  /** Blocking radius in world units (0 = decorative only). */
  solid: number;
  scale: number;
};

export type IslandMap = {
  seed: number;
  tiles: Terrain[];
  props: IslandProp[];
  spawn: { x: number; y: number };
  plaza: { x: number; y: number; r: number };
  hill: { x: number; y: number; r: number };
  dock: { x: number; y: number; r: number };
  campfire: { x: number; y: number; r: number };
  bridgeTiles: number[];
  starSpots: { x: number; y: number }[];
  coconutSpots: { x: number; y: number }[];
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (tx: number, ty: number) => ty * GRID_W + tx;
export const tileAt = (map: IslandMap, x: number, y: number): Terrain => {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return "water";
  return map.tiles[idx(tx, ty)];
};
export const elevationAt = (map: IslandMap, x: number, y: number) => ELEVATION[tileAt(map, x, y)];
export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Sunset Island: beach ring, village huts, rocky shelf, wooden bridge, hill, dock, plaza. */
export function buildIsland(seed = 20260820): IslandMap {
  const rnd = mulberry32(seed);
  const tiles: Terrain[] = new Array(GRID_W * GRID_H).fill("water");

  const cx = 20;
  const cy = 15;
  const plazaT = { x: cx, y: cy, r: 3.4 };
  const hillT = { x: 29.5, y: 8.5, r: 3.6 };
  const rockT = { x: 9.5, y: 21.5, r: 4.2 };

  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      const wobble = 0.05 * Math.sin(tx * 0.7) + 0.05 * Math.cos(ty * 0.6);
      const d = ((tx - cx) / 16) ** 2 + ((ty - cy) / 11.4) ** 2 + wobble;
      let t: Terrain = "water";
      if (d <= 0.78) t = "grass";
      else if (d <= 1.0) t = "sand";
      else if (d <= 1.16) t = "shallow";
      tiles[idx(tx, ty)] = t;
    }
  }

  // central safe plaza + high ground
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      const i = idx(tx, ty);
      if (tiles[i] === "water" || tiles[i] === "shallow") continue;
      if (dist(tx, ty, plazaT.x, plazaT.y) <= plazaT.r) tiles[i] = "plaza";
      else if (dist(tx, ty, hillT.x, hillT.y) <= hillT.r) tiles[i] = "hill";
      else if (dist(tx, ty, rockT.x, rockT.y) <= rockT.r) tiles[i] = "rock";
    }
  }

  // water channel + wooden bridge across the south-west of the island
  const bridgeTiles: number[] = [];
  for (let tx = 6; tx <= 30; tx++) {
    for (let ty = 19; ty <= 20; ty++) {
      const i = idx(tx, ty);
      if (tiles[i] === "water") continue;
      if (dist(tx, ty, plazaT.x, plazaT.y) <= plazaT.r + 0.5) continue;
      tiles[i] = tx >= 17 && tx <= 21 ? "bridge" : "shallow";
      if (tiles[i] === "bridge") bridgeTiles.push(i);
    }
  }

  // dock reaching out into the water to the south
  for (let tx = 19; tx <= 21; tx++) {
    for (let ty = 25; ty <= 29; ty++) tiles[idx(tx, ty)] = "dock";
  }

  const props: IslandProp[] = [];
  const pushProp = (kind: PropKind, tx: number, ty: number, solid: number, scale = 1) => {
    const c = tileCenter(tx, ty);
    props.push({ kind, x: c.x, y: c.y, solid, scale });
  };

  // village huts (north-west)
  const hutSpots: [number, number][] = [
    [12, 8],
    [15, 7],
    [11, 11],
    [15, 11],
    [13, 9],
  ];
  hutSpots.forEach(([tx, ty]) => {
    if (ELEVATION[tiles[idx(tx, ty)]] >= 1) pushProp("hut", tx, ty, 30, 1 + rnd() * 0.2);
  });
  pushProp("sign", 17, 9, 0, 1);

  // campfire plaza-side gathering spot
  const campfire = tileCenter(24, 20);
  pushProp("campfire", 24, 20, 16, 1);
  pushProp("barrel", 23, 21, 14, 1);
  pushProp("barrel", 25, 21, 14, 1);

  // rocks on the rocky shelf
  for (let n = 0; n < 10; n++) {
    const tx = Math.round(rockT.x + (rnd() - 0.5) * 6);
    const ty = Math.round(rockT.y + (rnd() - 0.5) * 6);
    if (tx < 1 || ty < 1 || tx >= GRID_W - 1 || ty >= GRID_H - 1) continue;
    if (tiles[idx(tx, ty)] !== "rock") continue;
    pushProp("rock", tx, ty, 20, 0.8 + rnd() * 0.6);
  }

  // palm trees around the beach + grass, never inside the plaza
  const coconutSpots: { x: number; y: number }[] = [];
  for (let n = 0; n < 200 && coconutSpots.length < 26; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * (GRID_H - 4));
    const t = tiles[idx(tx, ty)];
    if (t !== "sand" && t !== "grass") continue;
    if (dist(tx, ty, plazaT.x, plazaT.y) < plazaT.r + 1.5) continue;
    const c = tileCenter(tx, ty);
    if (props.some((p) => dist(p.x, p.y, c.x, c.y) < TILE * 1.6)) continue;
    pushProp("palm", tx, ty, 12, 0.85 + rnd() * 0.4);
    coconutSpots.push(c);
  }

  // stars: spread across every district so risky ones sit near the edges
  const starSpots: { x: number; y: number }[] = [];
  for (let n = 0; n < 400 && starSpots.length < 22; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * (GRID_H - 4));
    const t = tiles[idx(tx, ty)];
    if (t === "water") continue;
    const c = tileCenter(tx, ty);
    if (props.some((p) => p.solid > 0 && dist(p.x, p.y, c.x, c.y) < 34)) continue;
    if (starSpots.some((s) => dist(s.x, s.y, c.x, c.y) < TILE * 2.2)) continue;
    starSpots.push(c);
  }

  const plazaC = tileCenter(plazaT.x, plazaT.y);
  return {
    seed,
    tiles,
    props,
    spawn: { x: plazaC.x, y: plazaC.y + TILE },
    plaza: { x: plazaC.x, y: plazaC.y, r: plazaT.r * TILE },
    hill: { ...tileCenter(hillT.x, hillT.y), r: hillT.r * TILE },
    dock: { ...tileCenter(20, 27), r: TILE * 2.2 },
    campfire: { x: campfire.x, y: campfire.y, r: TILE * 1.6 },
    bridgeTiles,
    starSpots,
    coconutSpots,
  };
}

/** Walkable = not open water, unless the tile is a collapsed bridge plank. */
export function walkable(map: IslandMap, x: number, y: number, collapsed: Set<number>) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
  const i = idx(tx, ty);
  const t = map.tiles[i];
  if (t === "water") return false;
  if (t === "bridge" && collapsed.has(i)) return false;
  return true;
}
