/**
 * YAJ Snake Royale — Thornwood Jungle map (Phase 1, ONE polished map).
 *
 * A flat jungle landmass (no elevation system — nothing here needs Survival Island's
 * rising-water elevation ranking) split by a river with two bridge crossings, ruins in
 * the north-east, a rocky slope in the south-west used for rolling-rock hazards, and
 * mud flats scattered through the grass. Everything is generated from a seed so a
 * future friend-challenge mode can hand every player the same jungle.
 */

export type Terrain = "path" | "grass" | "water" | "shallow" | "mud" | "bridge" | "ruins" | "rock";

export const TILE = 44;
export const GRID_W = 40;
export const GRID_H = 30;
export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

export type PropKind = "tree" | "bush" | "log" | "vine" | "ruinWall" | "signpost" | "rockProp";

export type JungleProp = {
  kind: PropKind;
  x: number;
  y: number;
  /** Blocking radius in world units (0 = decorative only). */
  solid: number;
  scale: number;
};

export type DenKind = "bush" | "log" | "rock" | "water";
export type DenSpot = { x: number; y: number; kind: DenKind };

export type JungleMap = {
  seed: number;
  tiles: Terrain[];
  props: JungleProp[];
  spawn: { x: number; y: number };
  temple: { x: number; y: number; r: number };
  starSpots: { x: number; y: number }[];
  denSpots: DenSpot[];
  canopySpots: { x: number; y: number }[];
  slopeSpots: { x: number; y: number }[];
  bridgeTiles: number[];
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
export const tileAt = (map: JungleMap, x: number, y: number): Terrain => {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return "water";
  return map.tiles[idx(tx, ty)];
};
export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Walkable = not open water, unless the tile is a collapsed... there's no collapse here,
 *  water is simply never walkable; bridges over it are. */
export function walkable(map: JungleMap, x: number, y: number) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
  return map.tiles[idx(tx, ty)] !== "water";
}

/** Thornwood Jungle: grass landmass, a wandering river with two bridges, ruins,
 *  a rocky slope, and a few mud flats. */
export function buildJungle(seed = 20260822): JungleMap {
  const rnd = mulberry32(seed);
  const tiles: Terrain[] = new Array(GRID_W * GRID_H).fill("grass");

  // River: a band that wanders left-to-right across the middle of the map.
  const riverBaseY = 15;
  const riverWobble = (tx: number) => Math.sin(tx * 0.22) * 2.4 + Math.sin(tx * 0.07) * 1.6;
  for (let tx = 0; tx < GRID_W; tx++) {
    const cy = riverBaseY + riverWobble(tx);
    for (let ty = 0; ty < GRID_H; ty++) {
      const d = Math.abs(ty - cy);
      if (d < 1.6) tiles[idx(tx, ty)] = "water";
      else if (d < 2.5) tiles[idx(tx, ty)] = "shallow";
    }
  }

  // Two bridge crossings.
  const bridgeXs = [11, 29];
  const bridgeTiles: number[] = [];
  for (const bx of bridgeXs) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = bx + dx;
      const cy = riverBaseY + riverWobble(tx);
      for (let ty = Math.floor(cy - 3); ty <= Math.ceil(cy + 3); ty++) {
        if (ty < 0 || ty >= GRID_H) continue;
        const i = idx(tx, ty);
        tiles[i] = "bridge";
        bridgeTiles.push(i);
      }
    }
  }

  // Ruins in the north-east.
  const templeT = { x: 32, y: 6, r: 3.4 };
  // Rocky slope in the south-west.
  const rockT = { x: 6.5, y: 24, r: 4 };
  // Mud flats scattered through the grass.
  const mudZones = [
    { x: 15, y: 8, r: 2.4 },
    { x: 24, y: 23, r: 2.6 },
    { x: 34, y: 20, r: 2.1 },
  ];

  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      const i = idx(tx, ty);
      if (tiles[i] === "water" || tiles[i] === "shallow" || tiles[i] === "bridge") continue;
      if (dist(tx, ty, templeT.x, templeT.y) <= templeT.r) tiles[i] = "ruins";
      else if (dist(tx, ty, rockT.x, rockT.y) <= rockT.r) tiles[i] = "rock";
      else {
        for (const m of mudZones) {
          if (dist(tx, ty, m.x, m.y) <= m.r) {
            tiles[i] = "mud";
            break;
          }
        }
      }
    }
  }

  // A winding jungle path from spawn toward the temple, cosmetic ground variation.
  const spawnT = { x: 5, y: 5 };
  for (let tx = spawnT.x; tx <= 34; tx++) {
    const cy = spawnT.y + Math.sin(tx * 0.18) * 3 + (tx - spawnT.x) * 0.05;
    for (let dy = -1; dy <= 1; dy++) {
      const ty = Math.round(cy) + dy;
      if (ty < 0 || ty >= GRID_H) continue;
      const i = idx(tx, ty);
      if (tiles[i] === "grass") tiles[i] = "path";
    }
  }

  const props: JungleProp[] = [];
  const pushProp = (kind: PropKind, tx: number, ty: number, solid: number, scale = 1) => {
    const c = tileCenter(tx, ty);
    props.push({ kind, x: c.x, y: c.y, solid, scale });
  };

  // Ruin walls + a signpost marking the temple gate.
  pushProp("ruinWall", templeT.x - 2, templeT.y - 1, 22, 1.1);
  pushProp("ruinWall", templeT.x + 2, templeT.y - 1, 22, 1.1);
  pushProp("ruinWall", templeT.x, templeT.y + 2, 22, 1.3);
  pushProp("signpost", spawnT.x + 1, spawnT.y + 2, 0, 1);

  // Trees scattered through the grass — also double as canopy spots for falling branches.
  const canopySpots: { x: number; y: number }[] = [];
  for (let n = 0; n < 260 && canopySpots.length < 34; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * (GRID_H - 4));
    const t = tiles[idx(tx, ty)];
    if (t !== "grass" && t !== "mud") continue;
    const c = tileCenter(tx, ty);
    if (props.some((p) => p.solid > 0 && dist(p.x, p.y, c.x, c.y) < TILE * 1.4)) continue;
    pushProp("tree", tx, ty, 16, 0.9 + rnd() * 0.5);
    canopySpots.push(c);
    if (rnd() < 0.4) pushProp("vine", tx, ty, 0, 0.8 + rnd() * 0.4);
  }

  // Bushes — mostly snake dens, so keep a healthy spread through the grass.
  const denSpots: DenSpot[] = [];
  for (let n = 0; n < 260 && denSpots.length < 16; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * (GRID_H - 4));
    const t = tiles[idx(tx, ty)];
    if (t !== "grass" && t !== "path") continue;
    const c = tileCenter(tx, ty);
    if (props.some((p) => p.solid > 0 && dist(p.x, p.y, c.x, c.y) < TILE * 1.2)) continue;
    if (denSpots.some((d) => dist(d.x, d.y, c.x, c.y) < TILE * 2.6)) continue;
    pushProp("bush", tx, ty, 14, 0.85 + rnd() * 0.35);
    denSpots.push({ x: c.x, y: c.y, kind: "bush" });
  }

  // Logs along the river banks — more dens.
  for (let tx = 3; tx < GRID_W - 3; tx += 3) {
    const cy = riverBaseY + riverWobble(tx);
    const bankTy = Math.round(cy - 3.2);
    if (bankTy < 1 || bankTy >= GRID_H - 1) continue;
    const t = tiles[idx(tx, bankTy)];
    if (t !== "grass" && t !== "path") continue;
    if (rnd() > 0.55) continue;
    const c = tileCenter(tx, bankTy);
    if (denSpots.some((d) => dist(d.x, d.y, c.x, c.y) < TILE * 2.2)) continue;
    pushProp("log", tx, bankTy, 18, 1);
    denSpots.push({ x: c.x, y: c.y, kind: "log" });
  }

  // A few rock-cluster dens and water-edge dens for variety.
  for (let n = 0; n < 6; n++) {
    const tx = Math.round(rockT.x + (rnd() - 0.5) * rockT.r * 1.6);
    const ty = Math.round(rockT.y + (rnd() - 0.5) * rockT.r * 1.6);
    if (tx < 1 || ty < 1 || tx >= GRID_W - 1 || ty >= GRID_H - 1) continue;
    if (tiles[idx(tx, ty)] !== "rock") continue;
    const c = tileCenter(tx, ty);
    if (denSpots.some((d) => dist(d.x, d.y, c.x, c.y) < TILE * 2)) continue;
    pushProp("rockProp", tx, ty, 20, 0.8 + rnd() * 0.5);
    denSpots.push({ x: c.x, y: c.y, kind: "rock" });
  }
  for (let tx = 4; tx < GRID_W - 4; tx += 4) {
    const cy = riverBaseY + riverWobble(tx);
    const edgeTy = Math.round(cy + 3.2);
    if (edgeTy < 1 || edgeTy >= GRID_H - 1) continue;
    const t = tiles[idx(tx, edgeTy)];
    if (t !== "grass" && t !== "path" && t !== "mud") continue;
    if (rnd() > 0.5) continue;
    const c = tileCenter(tx, edgeTy);
    if (denSpots.some((d) => dist(d.x, d.y, c.x, c.y) < TILE * 2.2)) continue;
    denSpots.push({ x: c.x, y: c.y, kind: "water" });
  }

  // Slope spots for rolling rocks — the rocky south-west shelf.
  const slopeSpots: { x: number; y: number }[] = [];
  for (let n = 0; n < 60 && slopeSpots.length < 10; n++) {
    const tx = Math.round(rockT.x + (rnd() - 0.5) * rockT.r * 2);
    const ty = Math.round(rockT.y + (rnd() - 0.5) * rockT.r * 2);
    if (tx < 1 || ty < 1 || tx >= GRID_W - 1 || ty >= GRID_H - 1) continue;
    if (tiles[idx(tx, ty)] !== "rock") continue;
    slopeSpots.push(tileCenter(tx, ty));
  }

  // Stars spread across every biome so risky ones sit near the water/rock edges.
  const starSpots: { x: number; y: number }[] = [];
  for (let n = 0; n < 500 && starSpots.length < 24; n++) {
    const tx = 2 + Math.floor(rnd() * (GRID_W - 4));
    const ty = 2 + Math.floor(rnd() * (GRID_H - 4));
    const t = tiles[idx(tx, ty)];
    if (t === "water") continue;
    const c = tileCenter(tx, ty);
    if (props.some((p) => p.solid > 0 && dist(p.x, p.y, c.x, c.y) < 30)) continue;
    if (starSpots.some((s) => dist(s.x, s.y, c.x, c.y) < TILE * 2)) continue;
    starSpots.push(c);
  }

  const spawnC = tileCenter(spawnT.x, spawnT.y);
  return {
    seed,
    tiles,
    props,
    spawn: spawnC,
    temple: { ...tileCenter(templeT.x, templeT.y), r: templeT.r * TILE },
    starSpots,
    denSpots,
    canopySpots,
    slopeSpots,
    bridgeTiles,
  };
}
