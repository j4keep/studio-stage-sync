/**
 * YAJ Neighborhood Adventure — YAJ Central (Phase 1's one hand-designed map).
 *
 * Unlike Survival Island's seeded procedural island, this map is a small, fixed, hand-laid-out
 * neighborhood block — closer to how Mini Golf's holes are hand-designed than to a random
 * generator. There's no elevation/water hazard system here: every tile is walkable, and only
 * solid props (buildings, trees, the fountain rim) block movement, via the same circular-radius
 * collision Survival Island uses for its huts/rocks/palms.
 */

export type Terrain = "grass" | "sidewalk" | "street" | "plaza" | "alley" | "court";

export const TILE = 44;
export const GRID_W = 34;
export const GRID_H = 24;
export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

export type PropKind =
  | "cafe"
  | "corner_store"
  | "community_center"
  | "apartment"
  | "hoop"
  | "bench"
  | "tree"
  | "lamp"
  | "fountain"
  | "mural"
  | "sign"
  | "bus_shelter"
  | "planter"
  | "crate";

export type NeighborhoodProp = {
  kind: PropKind;
  x: number;
  y: number;
  /** Blocking radius in world units, 0 = decorative only. */
  solid: number;
  scale: number;
  label?: string;
  facing?: 1 | -1;
};

export type LocationId =
  | "street"
  | "park"
  | "cafe"
  | "corner_store"
  | "basketball_court"
  | "community_center"
  | "apartments"
  | "plaza"
  | "bus_stop"
  | "alley";

export type LocationSpot = { id: LocationId; name: string; x: number; y: number; r: number };

export type DiscoverySpot = { id: string; label: string; x: number; y: number; r: number };

export type NeighborhoodMapData = {
  tiles: Terrain[];
  props: NeighborhoodProp[];
  spawn: { x: number; y: number };
  locations: LocationSpot[];
  starSpots: { x: number; y: number }[];
  discoverySpots: DiscoverySpot[];
  missionSpots: {
    boxPickup: { x: number; y: number };
    ballHidden: { x: number; y: number };
    keysHidden: { x: number; y: number };
  };
};

export const idx = (tx: number, ty: number) => ty * GRID_W + tx;
export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
export const tileAt = (map: NeighborhoodMapData, x: number, y: number): Terrain => {
  const tx = Math.max(0, Math.min(GRID_W - 1, Math.floor(x / TILE)));
  const ty = Math.max(0, Math.min(GRID_H - 1, Math.floor(y / TILE)));
  return map.tiles[idx(tx, ty)];
};

function paintRect(tiles: Terrain[], x0: number, y0: number, x1: number, y1: number, t: Terrain) {
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
      tiles[idx(tx, ty)] = t;
    }
  }
}

/** Builds YAJ Central — the single Phase-1 neighborhood. */
export function buildNeighborhood(): NeighborhoodMapData {
  const tiles: Terrain[] = new Array(GRID_W * GRID_H).fill("grass");

  // Main street running east-west, with sidewalks bordering it.
  paintRect(tiles, 1, 13, 32, 14, "sidewalk");
  paintRect(tiles, 1, 15, 32, 16, "street");
  paintRect(tiles, 1, 17, 32, 17, "sidewalk");

  // Central plaza, just north of the street.
  paintRect(tiles, 14, 8, 19, 12, "plaza");

  // Park in the north-west, with a basketball court cut into it.
  paintRect(tiles, 2, 2, 12, 12, "grass");
  paintRect(tiles, 4, 4, 8, 7, "court");

  // Alley shortcut: a narrow back path from behind the corner store, south around, back up
  // near the cafe — a genuine alternate route across the block.
  paintRect(tiles, 24, 18, 26, 21, "alley");
  paintRect(tiles, 8, 18, 26, 21, "alley");
  paintRect(tiles, 8, 18, 10, 21, "alley");

  const props: NeighborhoodProp[] = [];
  const push = (p: NeighborhoodProp) => props.push(p);

  // Cafe — west side of the street, facing it.
  const cafe = tileCenter(6, 12);
  push({ kind: "cafe", x: cafe.x, y: cafe.y, solid: 46, scale: 1, label: "Cafe", facing: 1 });

  // Corner store — east side of the street.
  const store = tileCenter(27, 12);
  push({ kind: "corner_store", x: store.x, y: store.y, solid: 46, scale: 1, label: "Corner Store", facing: -1 });

  // Community center — south of the street, facing back toward the plaza.
  const center = tileCenter(17, 19);
  push({ kind: "community_center", x: center.x, y: center.y, solid: 52, scale: 1.05, label: "Community Center", facing: -1 });

  // Apartment block — north-east residential corner.
  push({ kind: "apartment", x: tileCenter(27, 4).x, y: tileCenter(27, 4).y, solid: 50, scale: 1, label: "Apartments" });
  push({ kind: "apartment", x: tileCenter(30, 6).x, y: tileCenter(30, 6).y, solid: 44, scale: 0.9, label: "Apartments" });
  push({ kind: "planter", x: tileCenter(26, 7).x, y: tileCenter(26, 7).y, solid: 12, scale: 1 });

  // Basketball hoop inside the court.
  push({ kind: "hoop", x: tileCenter(6, 4).x, y: tileCenter(6, 4).y, solid: 14, scale: 1 });

  // Fountain in the plaza.
  const fountain = tileCenter(16, 10);
  push({ kind: "fountain", x: fountain.x, y: fountain.y, solid: 30, scale: 1 });

  // Mural on the alley wall.
  const mural = tileCenter(9, 19);
  push({ kind: "mural", x: mural.x, y: mural.y, solid: 0, scale: 1, label: "Mural" });

  // Bus stop — far east end of the street.
  const busStop = tileCenter(31, 14);
  push({ kind: "bus_shelter", x: busStop.x, y: busStop.y, solid: 24, scale: 1, label: "Bus Stop" });

  // Trees, benches, lamps scattered for life.
  const decor: [PropKind, number, number, number][] = [
    ["tree", 3, 10, 16],
    ["tree", 11, 3, 16],
    ["tree", 20, 5, 16],
    ["tree", 13, 15, 0],
    ["tree", 21, 17, 16],
    ["bench", 15, 12, 10],
    ["bench", 18, 12, 10],
    ["bench", 5, 9, 10],
    ["lamp", 10, 13, 8],
    ["lamp", 22, 13, 8],
    ["lamp", 30, 13, 8],
    ["planter", 14, 13, 10],
    ["planter", 19, 13, 10],
  ];
  decor.forEach(([kind, tx, ty, solid]) => {
    const c = tileCenter(tx, ty);
    push({ kind, x: c.x, y: c.y, solid, scale: 1 });
  });

  const spawnC = tileCenter(16, 12);

  const locations: LocationSpot[] = [
    { id: "street", name: "Neighborhood Street", x: tileCenter(17, 15).x, y: tileCenter(17, 15).y, r: TILE * 8 },
    { id: "park", name: "Small Park", x: tileCenter(7, 6).x, y: tileCenter(7, 6).y, r: TILE * 5 },
    { id: "cafe", name: "Cafe", x: cafe.x, y: cafe.y, r: TILE * 1.6 },
    { id: "corner_store", name: "Corner Store", x: store.x, y: store.y, r: TILE * 1.6 },
    { id: "basketball_court", name: "Basketball Court", x: tileCenter(6, 5).x, y: tileCenter(6, 5).y, r: TILE * 2.4 },
    { id: "community_center", name: "Community Center", x: center.x, y: center.y, r: TILE * 1.8 },
    { id: "apartments", name: "Apartments", x: tileCenter(28, 5).x, y: tileCenter(28, 5).y, r: TILE * 3 },
    { id: "plaza", name: "Plaza", x: fountain.x, y: fountain.y, r: TILE * 2.8 },
    { id: "bus_stop", name: "Bus Stop", x: busStop.x, y: busStop.y, r: TILE * 1.6 },
    { id: "alley", name: "Alley Shortcut", x: tileCenter(17, 20).x, y: tileCenter(17, 20).y, r: TILE * 3 },
  ];

  // 10 hidden YAJ Stars, spread across every district.
  const starTiles: [number, number][] = [
    [3, 3],
    [10, 9],
    [5, 11],
    [22, 3],
    [30, 3],
    [29, 9],
    [13, 17],
    [23, 20],
    [4, 20],
    [32, 17],
  ];
  const starSpots = starTiles.map(([tx, ty]) => tileCenter(tx, ty));

  // Optional discoveries: hidden alley nook, rooftop lookout, park fountain, mural, secret bench.
  const discoverySpots: DiscoverySpot[] = [
    { id: "alley_nook", label: "Hidden Alley Nook", x: tileCenter(9, 20).x, y: tileCenter(9, 20).y, r: TILE * 1.3 },
    { id: "rooftop_lookout", label: "Rooftop Lookout", x: tileCenter(28, 3).x, y: tileCenter(28, 3).y, r: TILE * 1.3 },
    { id: "plaza_fountain", label: "Plaza Fountain", x: fountain.x, y: fountain.y, r: TILE * 1.4 },
    { id: "mural_wall", label: "Neighborhood Mural", x: mural.x, y: mural.y, r: TILE * 1.3 },
    { id: "quiet_bench", label: "Quiet Bench", x: tileCenter(5, 9).x, y: tileCenter(5, 9).y, r: TILE * 1.2 },
  ];

  return {
    tiles,
    props,
    spawn: spawnC,
    locations,
    starSpots,
    discoverySpots,
    missionSpots: {
      // Placed with clear separation from their linked NPC's own patrol route and from solid
      // props — close enough to read as "by the community center" / "near the park" / "near
      // the bus stop", but far enough that the pickup prompt never has to compete with a TALK
      // or ENTER prompt for the same spot, and the direct path there isn't blocked by a building.
      boxPickup: tileCenter(14, 17),
      ballHidden: tileCenter(10, 3),
      keysHidden: tileCenter(28, 17),
    },
  };
}

export function locationAt(map: NeighborhoodMapData, x: number, y: number): LocationSpot | null {
  let best: LocationSpot | null = null;
  let bestD = Infinity;
  for (const loc of map.locations) {
    const d = Math.hypot(x - loc.x, y - loc.y);
    if (d <= loc.r && d < bestD) {
      best = loc;
      bestD = d;
    }
  }
  return best;
}
