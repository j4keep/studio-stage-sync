/**
 * "Candy City" — Sugar Rush's Phase-1 maze. A deterministically-generated corridor grid
 * (seeded, so the same map builds every time — same contract Tower Escape's hand-authored
 * level uses: same layout + same inputs => same run, which async challenge modes need
 * later) with a handful of extra loops braided in for evasion routes, then decorated with
 * hand-placed landmarks (a shop plaza, checkpoints, a tunnel shortcut, hazards, power-ups,
 * and collectible clusters). Original layout — not modeled on any existing maze game.
 */

export type Dir = "n" | "s" | "e" | "w";
export const DIRS: Dir[] = ["n", "s", "e", "w"];
export const OPPOSITE: Record<Dir, Dir> = { n: "s", s: "n", e: "w", w: "e" };
export const DELTA: Record<Dir, { dc: number; dr: number }> = {
  n: { dc: 0, dr: -1 },
  s: { dc: 0, dr: 1 },
  e: { dc: 1, dr: 0 },
  w: { dc: -1, dr: 0 },
};

export type Cell = { c: number; r: number };
export type MazeCell = { open: Record<Dir, boolean> };

export type CollectibleKind = "gummy" | "candyDrop" | "sugarStar" | "donutToken" | "frostingGem";
export type PowerupKind = "speed" | "shield" | "magnet" | "freeze";

export type Collectible = { id: string; kind: CollectibleKind; c: number; r: number };
export type PowerupSpawn = { id: string; kind: PowerupKind; c: number; r: number };
export type Checkpoint = { id: string; c: number; r: number; index: number };
export type TunnelPair = { id: string; a: Cell; b: Cell };

export type HazardZone =
  | { id: string; kind: "syrup"; cells: Cell[] }
  | { id: string; kind: "sourPatch"; cells: Cell[] }
  | { id: string; kind: "chocolateBlock"; a: Cell; b: Cell; onSec: number; offSec: number; phase: number };

export type CandyCityMap = {
  cols: number;
  rows: number;
  cellSize: number;
  cells: MazeCell[];
  start: Cell;
  cavitySpawn: Cell;
  exit: Cell;
  shopPlaza: Cell[];
  checkpoints: Checkpoint[];
  tunnels: TunnelPair[];
  collectibles: Collectible[];
  powerups: PowerupSpawn[];
  hazards: HazardZone[];
  cartPath: Cell[];
};

export const COLS = 15;
export const ROWS = 19;
export const CELL = 80;

/** Small deterministic PRNG (mulberry32) so the map is identical on every build/run. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idx = (c: number, r: number) => r * COLS + c;
const inBounds = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

function generateGrid(rng: () => number): MazeCell[] {
  const cells: MazeCell[] = Array.from({ length: COLS * ROWS }, () => ({
    open: { n: false, s: false, e: false, w: false },
  }));
  const visited = new Set<number>();
  const stack: Cell[] = [{ c: 0, r: 0 }];
  visited.add(idx(0, 0));

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = DIRS.map((d) => ({ d, ...DELTA[d] }))
      .map(({ d, dc, dr }) => ({ d, c: cur.c + dc, r: cur.r + dr }))
      .filter((n) => inBounds(n.c, n.r) && !visited.has(idx(n.c, n.r)));

    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    cells[idx(cur.c, cur.r)].open[pick.d] = true;
    cells[idx(pick.c, pick.r)].open[OPPOSITE[pick.d]] = true;
    visited.add(idx(pick.c, pick.r));
    stack.push({ c: pick.c, r: pick.r });
  }

  // Braid in extra loops so there's more than one way around — a perfect maze (one unique
  // path between any two cells) makes evading a chaser impossible; carving a chunk of extra
  // connections gives real escape routes.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (rng() > 0.16) continue;
      const d = DIRS[Math.floor(rng() * 4)];
      const { dc, dr } = DELTA[d];
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      cells[idx(c, r)].open[d] = true;
      cells[idx(nc, nr)].open[OPPOSITE[d]] = true;
    }
  }

  return cells;
}

/** Carves a rectangular open plaza (removes interior walls) — used for the Candy Shop
 *  landmark, so it reads as a real room rather than another corridor. */
function carvePlaza(cells: MazeCell[], topLeft: Cell, w: number, h: number): Cell[] {
  const plazaCells: Cell[] = [];
  for (let r = topLeft.r; r < topLeft.r + h; r++) {
    for (let c = topLeft.c; c < topLeft.c + w; c++) {
      if (!inBounds(c, r)) continue;
      plazaCells.push({ c, r });
      for (const d of DIRS) {
        const { dc, dr } = DELTA[d];
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= topLeft.c && nc < topLeft.c + w && nr >= topLeft.r && nr < topLeft.r + h) {
          cells[idx(c, r)].open[d] = true;
        }
      }
    }
  }
  return plazaCells;
}

let cached: CandyCityMap | null = null;

export function buildCandyCity(): CandyCityMap {
  if (cached) return cached;
  const rng = makeRng(0xc4dd7);
  const cells = generateGrid(rng);

  const start: Cell = { c: 1, r: 1 };
  const exit: Cell = { c: COLS - 2, r: ROWS - 2 };
  const cavitySpawn: Cell = { c: Math.floor(COLS / 2), r: Math.floor(ROWS / 2) };
  const shopPlaza = carvePlaza(cells, { c: 5, r: 8 }, 3, 3);

  const checkpoints: Checkpoint[] = [
    { id: "cp1", c: COLS - 2, r: 2, index: 1 },
    { id: "cp2", c: 2, r: Math.floor(ROWS / 2), index: 2 },
    { id: "cp3", c: COLS - 3, r: ROWS - 4, index: 3 },
  ];

  const tunnels: TunnelPair[] = [
    { id: "tunnel1", a: { c: 1, r: ROWS - 3 }, b: { c: COLS - 2, r: 4 } },
  ];

  const hazards: HazardZone[] = [
    { id: "syrup1", kind: "syrup", cells: [{ c: 6, r: 3 }, { c: 7, r: 3 }, { c: 6, r: 4 }] },
    { id: "syrup2", kind: "syrup", cells: [{ c: 3, r: ROWS - 5 }, { c: 4, r: ROWS - 5 }] },
    { id: "sour1", kind: "sourPatch", cells: [{ c: 10, r: 9 }] },
    { id: "sour2", kind: "sourPatch", cells: [{ c: 3, r: 12 }] },
    {
      id: "choc1",
      kind: "chocolateBlock",
      a: { c: 8, r: 6 },
      b: { c: 9, r: 6 },
      onSec: 2.6,
      offSec: 2.2,
      phase: 0,
    },
    {
      id: "choc2",
      kind: "chocolateBlock",
      a: { c: 5, r: 14 },
      b: { c: 5, r: 15 },
      onSec: 2.2,
      offSec: 2.6,
      phase: 0.5,
    },
  ];
  // Force these connections open so the toggling block has something to gate — a chocolate
  // block sits ON an existing corridor edge rather than creating a new one.
  for (const h of hazards) {
    if (h.kind !== "chocolateBlock") continue;
    const d = h.a.c === h.b.c ? (h.a.r < h.b.r ? "s" : "n") : h.a.c < h.b.c ? "e" : "w";
    cells[idx(h.a.c, h.a.r)].open[d as Dir] = true;
    cells[idx(h.b.c, h.b.r)].open[OPPOSITE[d as Dir]] = true;
  }

  const cartPath: Cell[] = [
    { c: 9, r: 12 },
    { c: 10, r: 12 },
    { c: 11, r: 12 },
    { c: 12, r: 12 },
    { c: 11, r: 12 },
    { c: 10, r: 12 },
  ];
  for (let i = 0; i < cartPath.length - 1; i++) {
    const a = cartPath[i];
    const b = cartPath[i + 1];
    if (a.c === b.c && a.r === b.r) continue;
    const d = a.c < b.c ? "e" : a.c > b.c ? "w" : a.r < b.r ? "s" : "n";
    cells[idx(a.c, a.r)].open[d] = true;
    cells[idx(b.c, b.r)].open[OPPOSITE[d]] = true;
  }

  const powerups: PowerupSpawn[] = [
    { id: "pu1", kind: "speed", c: 12, r: 2 },
    { id: "pu2", kind: "shield", c: 2, r: 6 },
    { id: "pu3", kind: "magnet", c: 12, r: 16 },
    { id: "pu4", kind: "freeze", c: 6, r: 17 },
  ];

  // Collectibles: scatter gummies/candy drops through most open cells, sugar stars at
  // dead ends (exactly one open side), donut tokens ringing the shop plaza, and three
  // frosting gems in far corners for the "find 3" objective.
  const collectibles: Collectible[] = [];
  const reserved = new Set<string>([
    `${start.c},${start.r}`,
    ...shopPlaza.map((p) => `${p.c},${p.r}`),
    ...powerups.map((p) => `${p.c},${p.r}`),
  ]);
  let gi = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`;
      if (reserved.has(key)) continue;
      const openCount = DIRS.filter((d) => cells[idx(c, r)].open[d]).length;
      if (openCount === 1 && rng() < 0.7) {
        collectibles.push({ id: `star${gi++}`, kind: "sugarStar", c, r });
      } else if (rng() < 0.42) {
        collectibles.push({ id: `c${gi++}`, kind: rng() < 0.7 ? "gummy" : "candyDrop", c, r });
      }
    }
  }
  for (const p of shopPlaza) {
    if (rng() < 0.5) collectibles.push({ id: `donut${gi++}`, kind: "donutToken", c: p.c, r: p.r });
  }
  const gemSpots: Cell[] = [
    { c: COLS - 2, r: 1 },
    { c: 1, r: ROWS - 2 },
    { c: Math.floor(COLS / 2), r: 1 },
  ];
  for (const g of gemSpots) collectibles.push({ id: `gem${gi++}`, kind: "frostingGem", c: g.c, r: g.r });

  cached = {
    cols: COLS,
    rows: ROWS,
    cellSize: CELL,
    cells,
    start,
    cavitySpawn,
    exit,
    shopPlaza,
    checkpoints,
    tunnels,
    collectibles,
    powerups,
    hazards,
    cartPath,
  };
  return cached;
}

export function cellIndex(c: number, r: number) {
  return idx(c, r);
}

export function cellCenter(cell: Cell) {
  return { x: cell.c * CELL + CELL / 2, y: cell.r * CELL + CELL / 2 };
}
