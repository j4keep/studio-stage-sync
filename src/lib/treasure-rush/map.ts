/**
 * YAJ TREASURE RUSH — Level 1 "Lost City Market".
 *
 * The level is authored as an ASCII grid so map pieces stay reusable and cheap.
 * MapManager duties live here: parsing, collision lookup, decor extraction.
 *
 * Legend
 *   #  wall / building        .  floor          =  bridge floor
 *   s  market stall (solid)   t  tree (solid)   f  fountain (solid)   r  crate (solid)
 *   c  YAJ coin               g  star gem       C  treasure chest     G  gold chest
 *   b  blue key               k  gold key       B  blue gate          T  switch gate
 *   S  switch                 x  floor spikes   ~  slippery puddle
 *   M  treasure magnet        F  speed boost    H  shield
 *   P  player start           E  exit
 */

export const TILE = 2.4;

export type Cell = string;

const RAW = [
  "#############################",
  "#########....E......#########",
  "#########.c......c..#########",
  "#########...........#########",
  "##########=========##########",
  "##########=..c.g..=##########",
  "##########=========##########",
  "###########.......###########",
  "##############T##############",
  "###########.......###########",
  "############.....############",
  "###..c.....#.....#.....g..###",
  "###..b.....#.....#..G..g..###",
  "###...r....#..c..#...r....###",
  "###......x........B.......###",
  "###..S.....#..c..#....S...###",
  "###...C....#.....#...C....###",
  "###........#..c..#........###",
  "#####.######.....######.#####",
  "#####.######..c..######.#####",
  "#####.######.....######.#####",
  "#####.######.....######.#####",
  "###....####.......####....###",
  "###..x.####..c.c..####..t.###",
  "###..k.####.s...s.####..g.###",
  "###....####.......####..H.###",
  "###.~..####..c.c..####....###",
  "###....####.s...s.####..x.###",
  "###..c.####.......####..c.###",
  "###....####..c.c..####....###",
  "###..c.................c..###",
  "####.....................####",
  "####...M.............x...####",
  "####.c.................c.####",
  "####........fff..........####",
  "####...c....fff....c.....####",
  "####........fff..........####",
  "####.........P...........####",
  "####.....................####",
  "#############################",
];

export const MAP_W = 29;
export const MAP_H = RAW.length;

/** Rows normalised to the grid width so a stray character can never open an edge. */
export const GRID: Cell[][] = RAW.map((row) => {
  const padded = (row + "#".repeat(MAP_W)).slice(0, MAP_W);
  return padded.split("");
});

const SOLID = new Set(["#", "s", "t", "f", "r"]);

export function cellAt(col: number, row: number): Cell {
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return "#";
  return GRID[row][col];
}

/** Static solidity — gates are handled by the engine because they open. */
export function isStaticSolid(col: number, row: number) {
  return SOLID.has(cellAt(col, row));
}

export function worldOf(col: number, row: number) {
  return { x: col * TILE, z: row * TILE };
}

export function tileOf(x: number, z: number) {
  return { col: Math.round(x / TILE), row: Math.round(z / TILE) };
}

export type Spot = { col: number; row: number; x: number; z: number };

function collect(chars: string[]): Spot[] {
  const out: Spot[] = [];
  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      if (chars.includes(GRID[row][col])) out.push({ col, row, ...worldOf(col, row) });
    }
  }
  return out;
}

export const LEVEL = {
  start: collect(["P"])[0] ?? { col: 14, row: 37, ...worldOf(14, 37) },
  exit: collect(["E"])[0] ?? { col: 13, row: 1, ...worldOf(13, 1) },
  coins: collect(["c"]),
  gems: collect(["g"]),
  chests: collect(["C"]),
  goldChests: collect(["G"]),
  blueKeys: collect(["b"]),
  goldKeys: collect(["k"]),
  switches: collect(["S"]),
  blueGates: collect(["B"]),
  switchGates: collect(["T"]),
  spikes: collect(["x"]),
  puddles: collect(["~"]),
  magnets: collect(["M"]),
  boosts: collect(["F"]),
  shields: collect(["H"]),
  bridges: collect(["="]),
  stalls: collect(["s"]),
  trees: collect(["t"]),
  fountains: collect(["f"]),
  crates: collect(["r"]),
};

/** Every walkable tile (used for the floor mesh + mini-map). */
export const FLOOR: Spot[] = (() => {
  const out: Spot[] = [];
  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      if (!SOLID.has(GRID[row][col])) out.push({ col, row, ...worldOf(col, row) });
    }
  }
  return out;
})();

/** Horizontal runs of solid wall tiles merged into single boxes to keep draw calls low. */
export type WallRun = { x: number; z: number; w: number };

export const WALL_RUNS: WallRun[] = (() => {
  const runs: WallRun[] = [];
  for (let row = 0; row < MAP_H; row++) {
    let start = -1;
    for (let col = 0; col <= MAP_W; col++) {
      const wall = col < MAP_W && GRID[row][col] === "#";
      if (wall && start < 0) start = col;
      if (!wall && start >= 0) {
        const len = col - start;
        runs.push({ x: (start + len / 2 - 0.5) * TILE, z: row * TILE, w: len * TILE });
        start = -1;
      }
    }
  }
  return runs;
})();

/** Barrels roll up and down the two market-street lanes — a light, readable hazard. */
export const BARREL_TRACKS = [
  { col: 13, from: 22, to: 29, speed: 4.4, phase: 0 },
  { col: 15, from: 22, to: 29, speed: 5.2, phase: 0.5 },
  { col: 14, from: 11, to: 17, speed: 3.6, phase: 0.25 },
];
