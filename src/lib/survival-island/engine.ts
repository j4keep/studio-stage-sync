/**
 * YAJ Survival Island — deterministic survival engine.
 *
 * Responsibilities split (kept modular so more hazards can be added later):
 *  - player movement / collision           → movePlayer()
 *  - hazard waves + spawning               → tickWaves() (uses ./hazards)
 *  - flood / wind / collapse resolution    → tickFlood/tickWind/tickCollapse
 *  - health, stars, power-ups, objectives  → damage(), tickPickups(), tickObjectives()
 *  - timer + score                         → step()
 *
 * Everything is driven by a seeded RNG so one seed = one identical run for every
 * player (groundwork for the later "Last One Standing" / friend-challenge modes).
 */

import {
  Collapse,
  Flood,
  ImpactHazard,
  MAX_ACTIVE_HAZARDS,
  WAVES,
  WAVE_MS,
  Wind,
  bridgeTileIndex,
  coconutInterval,
  crateInterval,
  spawnCoconut,
  spawnCrate,
  startCollapse,
  startFlood,
  startWind,
  waveFor,
} from "./hazards";
import {
  ELEVATION,
  GRID_W,
  IslandMap,
  TILE,
  WORLD_H,
  WORLD_W,
  buildIsland,
  elevationAt,
  idx,
  mulberry32,
  tileAt,
  tileCenter,
  walkable,
} from "./map";

export const RUN_MS = 150_000;
export const MAX_HEARTS = 3;
export const PLAYER_R = 15;
const BASE_SPEED = 208;
const ACCEL = 12;

export type IslandEvent =
  | "star"
  | "power"
  | "heart"
  | "coconut"
  | "crate"
  | "warn"
  | "hit"
  | "splash"
  | "wave"
  | "wind"
  | "collapse"
  | "objective"
  | "timer";

export type IslandAnim = "idle" | "run" | "hit" | "wade" | "celebrate";

export type Star = { x: number; y: number; taken: boolean; respawn: number };
export type Pickup = { id: number; kind: "shield" | "speed" | "heart"; x: number; y: number; t: number };
export type Objective = { id: string; label: string; target: number; progress: number; done: boolean };

export type IslandInput = { mx: number; my: number };
export const NO_INPUT: IslandInput = { mx: 0, my: 0 };

export type IslandState = {
  map: IslandMap;
  rnd: () => number;
  t: number;
  timeLeft: number;
  /** Solo mode: endless survival — no win-by-timer, just hearts or a manual quit. */
  endless: boolean;
  status: "alive" | "survived" | "over";
  hearts: number;
  invuln: number;
  stars: number;
  score: number;
  avoided: number;
  streak: number;
  bestStreak: number;
  wave: number;
  waveFlash: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: IslandAnim;
  submerged: number;
  hazards: ImpactHazard[];
  flood: Flood;
  wind: Wind;
  collapse: Collapse;
  collapsed: Set<number>;
  starList: Star[];
  pickups: Pickup[];
  powers: { shield: number; speed: number };
  objectives: Objective[];
  nextCoconut: number;
  nextCrate: number;
  nextFlood: number;
  nextWind: number;
  nextCollapse: number;
  nextPickup: number;
  events: IslandEvent[];
  toast: { text: string; t: number } | null;
};

const OBJECTIVE_POOL: Omit<Objective, "progress" | "done">[] = [
  { id: "stars5", label: "Collect 5 stars", target: 5 },
  { id: "dock", label: "Reach the dock", target: 1 },
  { id: "hill", label: "Visit the hill", target: 1 },
  { id: "avoid3", label: "Dodge 3 hazards in a row", target: 3 },
  { id: "campfire", label: "Warm up at the campfire", target: 1 },
];

export function initialIsland(seed = Math.floor(Math.random() * 1_000_000), endless = false): IslandState {
  const map = buildIsland(20260820);
  const rnd = mulberry32(seed);
  const pool = [...OBJECTIVE_POOL];
  const objectives: Objective[] = [];
  while (objectives.length < 2 && pool.length) {
    const [o] = pool.splice(Math.floor(rnd() * pool.length), 1);
    objectives.push({ ...o, progress: 0, done: false });
  }

  return {
    map,
    rnd,
    t: 0,
    timeLeft: RUN_MS,
    endless,
    status: "alive",
    hearts: MAX_HEARTS,
    invuln: 0,
    stars: 0,
    score: 0,
    avoided: 0,
    streak: 0,
    bestStreak: 0,
    wave: 1,
    waveFlash: 2.6,
    x: map.spawn.x,
    y: map.spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    anim: "idle",
    submerged: 0,
    hazards: [],
    flood: { active: false, level: 0, phase: "warn", t: 0, rise: 0 },
    wind: { active: false, dx: 0, dy: 0, strength: 0, t: 0 },
    collapse: { active: false, tiles: [], phase: "warn", t: 0 },
    collapsed: new Set<number>(),
    starList: map.starSpots.map((s) => ({ x: s.x, y: s.y, taken: false, respawn: 0 })),
    pickups: [],
    powers: { shield: 0, speed: 0 },
    objectives,
    nextCoconut: 3.2,
    nextCrate: Infinity,
    nextFlood: 26,
    nextWind: 62,
    nextCollapse: 96,
    nextPickup: 12,
    events: [],
    toast: null,
  };
}

let pickupId = 1;

export function step(st: IslandState, input: IslandInput, dtMs: number): IslandState {
  if (st.status !== "alive") return st;
  const dt = Math.min(0.05, dtMs / 1000);
  st.events = [];
  st.t += dt;

  const prevSecond = Math.ceil(st.timeLeft / 1000);
  st.timeLeft = Math.max(0, st.timeLeft - dtMs);
  const nowSecond = Math.ceil(st.timeLeft / 1000);
  if (nowSecond !== prevSecond && nowSecond <= 10 && nowSecond > 0) st.events.push("timer");

  const wave = waveFor(st.t * 1000);
  if (wave !== st.wave) {
    st.wave = wave;
    st.waveFlash = 2.6;
    st.events.push("wave");
    if (wave >= 4) st.nextCrate = Math.min(st.nextCrate, st.t + 2);
  }
  st.waveFlash = Math.max(0, st.waveFlash - dt);
  st.invuln = Math.max(0, st.invuln - dt);
  st.powers.shield = Math.max(0, st.powers.shield - dt);
  st.powers.speed = Math.max(0, st.powers.speed - dt);
  if (st.toast) {
    st.toast.t -= dt;
    if (st.toast.t <= 0) st.toast = null;
  }

  movePlayer(st, input, dt);
  tickWaves(st, dt);
  tickHazards(st, dt);
  tickFlood(st, dt);
  tickWind(st, dt);
  tickCollapse(st, dt);
  tickStars(st, dt);
  tickPickups(st, dt);
  tickObjectives(st);

  st.score =
    Math.floor(st.t) * 10 +
    st.stars * 120 +
    st.avoided * 40 +
    st.objectives.filter((o) => o.done).length * 300;

  if (st.hearts <= 0) {
    st.status = "over";
  } else if (!st.endless && st.timeLeft <= 0) {
    st.status = "survived";
    st.anim = "celebrate";
  }
  return st;
}

/* ------------------------------- player ------------------------------- */

function movePlayer(st: IslandState, input: IslandInput, dt: number) {
  const mag = Math.hypot(input.mx, input.my);
  const boost = st.powers.speed > 0 ? 1.45 : 1;
  const wading = ELEVATION[tileAt(st.map, st.x, st.y)] <= 0;
  const terrainMul = wading ? 0.72 : 1;
  const speed = BASE_SPEED * boost * terrainMul;

  let tx = 0;
  let ty = 0;
  if (mag > 0.08) {
    const n = Math.min(1, mag);
    tx = (input.mx / mag) * n * speed;
    ty = (input.my / mag) * n * speed;
  }

  // wind gently pushes the character; controls can always compensate
  if (st.wind.active && st.wind.t > 0.6) {
    tx += st.wind.dx * st.wind.strength;
    ty += st.wind.dy * st.wind.strength;
  }

  st.vx += (tx - st.vx) * Math.min(1, ACCEL * dt);
  st.vy += (ty - st.vy) * Math.min(1, ACCEL * dt);
  if (Math.abs(st.vx) > 6) st.facing = st.vx > 0 ? 1 : -1;

  slide(st, st.vx * dt, 0);
  slide(st, 0, st.vy * dt);

  // crates that already landed are solid obstacles while they linger
  for (const h of st.hazards) {
    if (h.kind !== "crate" || !h.impacted || h.linger <= 0) continue;
    const d = Math.hypot(st.x - h.x, st.y - h.y);
    const min = PLAYER_R + 20;
    if (d < min && d > 0.01) {
      st.x += ((st.x - h.x) / d) * (min - d);
      st.y += ((st.y - h.y) / d) * (min - d);
    }
  }

  const moving = Math.hypot(st.vx, st.vy) > 26;
  if (st.invuln > 0.75) st.anim = "hit";
  else if (wading) st.anim = moving ? "wade" : "idle";
  else st.anim = moving ? "run" : "idle";
}

/** Axis-separated movement so the player slides along coastlines and props. */
function slide(st: IslandState, dx: number, dy: number) {
  const nx = st.x + dx;
  const ny = st.y + dy;
  if (!blocked(st, nx, ny)) {
    st.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, nx));
    st.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, ny));
  } else {
    if (dx) st.vx *= 0.2;
    if (dy) st.vy *= 0.2;
  }
}

function blocked(st: IslandState, x: number, y: number) {
  for (const [ox, oy] of [
    [PLAYER_R * 0.7, 0],
    [-PLAYER_R * 0.7, 0],
    [0, PLAYER_R * 0.6],
    [0, -PLAYER_R * 0.6],
  ]) {
    if (!walkable(st.map, x + ox, y + oy, st.collapsed)) return true;
  }
  for (const p of st.map.props) {
    if (p.solid <= 0) continue;
    if (Math.hypot(x - p.x, y - p.y) < p.solid * 0.8 + PLAYER_R * 0.55) return true;
  }
  return false;
}

/* ------------------------------- waves -------------------------------- */

function tickWaves(st: IslandState, _dt: number) {
  const wave = st.wave;
  if (st.t >= st.nextCoconut && st.hazards.length < MAX_ACTIVE_HAZARDS) {
    const count = wave >= 5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      st.hazards.push(spawnCoconut(st.map, st.rnd, { x: st.x, y: st.y }));
    }
    st.events.push("warn");
    st.nextCoconut = st.t + coconutInterval(wave) * (0.7 + st.rnd() * 0.6);
  }

  if (wave >= 4 && st.t >= st.nextCrate && st.hazards.length < MAX_ACTIVE_HAZARDS) {
    const c = spawnCrate(st.map, st.rnd, st.collapsed, { x: st.x, y: st.y });
    if (c) {
      st.hazards.push(c);
      st.events.push("warn");
    }
    st.nextCrate = st.t + crateInterval(wave) * (0.8 + st.rnd() * 0.6);
  }

  if (wave >= 2 && !st.flood.active && st.t >= st.nextFlood) {
    // never floods the plaza / hill / rocks: guaranteed reachable safe ground
    st.flood = startFlood(wave >= 5 && st.rnd() < 0.5 ? 2 : 1);
    st.events.push("warn");
    st.nextFlood = st.t + 40 + st.rnd() * 12;
    announce(st, "Rising water — get to high ground");
  }

  if (wave >= 3 && !st.wind.active && st.t >= st.nextWind) {
    st.wind = startWind(st.rnd, wave);
    st.events.push("wind");
    st.nextWind = st.t + 26 + st.rnd() * 10;
    announce(st, "Strong winds");
  }

  if (wave >= 5 && !st.collapse.active && st.t >= st.nextCollapse) {
    const c = startCollapse(st.map, st.rnd);
    if (c) {
      st.collapse = c;
      st.events.push("warn");
      announce(st, "The bridge is giving way");
    }
    st.nextCollapse = st.t + 34 + st.rnd() * 10;
  }
}

function tickHazards(st: IslandState, dt: number) {
  for (const h of st.hazards) {
    if (!h.impacted) {
      h.warn -= dt;
      if (h.warn <= 0) {
        h.impacted = true;
        st.events.push(h.kind);
        const hit = Math.hypot(st.x - h.x, st.y - h.y) < h.radius;
        if (hit) {
          h.hitPlayer = true;
          damage(st);
        } else {
          st.avoided++;
          st.streak++;
          st.bestStreak = Math.max(st.bestStreak, st.streak);
        }
      }
    } else {
      h.age += dt;
      if (h.kind === "crate") h.linger -= dt;
    }
  }
  st.hazards = st.hazards.filter((h) =>
    h.kind === "crate" ? !h.impacted || h.linger > -0.6 : !h.impacted || h.age < 0.8,
  );
}

function tickFlood(st: IslandState, dt: number) {
  const f = st.flood;
  if (!f.active) {
    st.submerged = Math.max(0, st.submerged - dt * 1.5);
    return;
  }
  f.t += dt;
  if (f.phase === "warn" && f.t > 1.6) {
    f.phase = "rising";
    f.t = 0;
    st.events.push("splash");
  } else if (f.phase === "rising") {
    f.rise = Math.min(1, f.t / 1.8);
    if (f.rise >= 1) {
      f.phase = "hold";
      f.t = 0;
    }
  } else if (f.phase === "hold" && f.t > 8) {
    f.phase = "receding";
    f.t = 0;
  } else if (f.phase === "receding") {
    f.rise = Math.max(0, 1 - f.t / 1.8);
    if (f.rise <= 0) {
      st.flood = { active: false, level: 0, phase: "warn", t: 0, rise: 0 };
      st.submerged = 0;
      return;
    }
  }

  const unsafe = f.rise > 0.35 && elevationAt(st.map, st.x, st.y) <= f.level;
  if (unsafe) {
    st.submerged += dt;
    if (st.submerged >= 1.7) {
      st.submerged = 0;
      damage(st);
    }
  } else {
    st.submerged = Math.max(0, st.submerged - dt * 1.4);
  }
}

function tickWind(st: IslandState, dt: number) {
  if (!st.wind.active) return;
  st.wind.t += dt;
  if (st.wind.t > 7.5) st.wind = { active: false, dx: 0, dy: 0, strength: 0, t: 0 };
}

function tickCollapse(st: IslandState, dt: number) {
  const c = st.collapse;
  if (!c.active) return;
  c.t += dt;
  if (c.phase === "warn" && c.t > 1.8) {
    c.phase = "out";
    c.t = 0;
    c.tiles.forEach((i) => st.collapsed.add(i));
    st.events.push("collapse");
    // standing on a plank that drops: splash down and respawn on the plaza
    if (st.collapsed.has(bridgeTileIndex(st.x, st.y))) {
      damage(st);
      st.x = st.map.plaza.x;
      st.y = st.map.plaza.y;
      st.vx = st.vy = 0;
    }
  } else if (c.phase === "out" && c.t > 7) {
    c.tiles.forEach((i) => st.collapsed.delete(i));
    st.collapse = { active: false, tiles: [], phase: "warn", t: 0 };
  }
}

/* --------------------------- collectibles ----------------------------- */

function tickStars(st: IslandState, dt: number) {
  for (const s of st.starList) {
    if (s.taken) {
      s.respawn -= dt;
      if (s.respawn <= 0) s.taken = false;
      continue;
    }
    if (Math.hypot(st.x - s.x, st.y - s.y) < PLAYER_R + 16) {
      s.taken = true;
      s.respawn = 26;
      st.stars++;
      st.events.push("star");
    }
  }
}

function tickPickups(st: IslandState, dt: number) {
  if (st.t >= st.nextPickup && st.pickups.length < 3) {
    const kinds: Pickup["kind"][] = st.hearts < MAX_HEARTS ? ["shield", "speed", "heart"] : ["shield", "speed"];
    const kind = kinds[Math.floor(st.rnd() * kinds.length)];
    for (let n = 0; n < 40; n++) {
      const tx = 3 + Math.floor(st.rnd() * (GRID_W - 6));
      const ty = 3 + Math.floor(st.rnd() * 24);
      if (st.map.tiles[idx(tx, ty)] === "water") continue;
      const c = tileCenter(tx, ty);
      st.pickups.push({ id: pickupId++, kind, x: c.x, y: c.y, t: 0 });
      break;
    }
    st.nextPickup = st.t + 15 + st.rnd() * 8;
  }

  for (const p of st.pickups) p.t += dt;
  st.pickups = st.pickups.filter((p) => {
    if (Math.hypot(st.x - p.x, st.y - p.y) < PLAYER_R + 18) {
      if (p.kind === "shield") st.powers.shield = 12;
      else if (p.kind === "speed") st.powers.speed = 8;
      else {
        st.hearts = Math.min(MAX_HEARTS, st.hearts + 1);
        st.events.push("heart");
        announce(st, "Heart restored");
      }
      if (p.kind !== "heart") st.events.push("power");
      return false;
    }
    return p.t < 22;
  });
}

function tickObjectives(st: IslandState) {
  for (const o of st.objectives) {
    if (o.done) continue;
    if (o.id === "stars5") o.progress = st.stars;
    else if (o.id === "avoid3") o.progress = st.bestStreak;
    else if (o.id === "dock" && Math.hypot(st.x - st.map.dock.x, st.y - st.map.dock.y) < st.map.dock.r) o.progress = 1;
    else if (o.id === "hill" && Math.hypot(st.x - st.map.hill.x, st.y - st.map.hill.y) < st.map.hill.r) o.progress = 1;
    else if (
      o.id === "campfire" &&
      Math.hypot(st.x - st.map.campfire.x, st.y - st.map.campfire.y) < st.map.campfire.r + 20
    )
      o.progress = 1;
    if (o.progress >= o.target) {
      o.done = true;
      st.events.push("objective");
      announce(st, `Bonus complete — ${o.label}`);
    }
  }
}

/* ------------------------------ health -------------------------------- */

function damage(st: IslandState) {
  if (st.invuln > 0) return;
  if (st.powers.shield > 0) {
    st.powers.shield = 0;
    st.invuln = 0.9;
    st.events.push("power");
    announce(st, "Shield absorbed the hit");
    return;
  }
  st.hearts = Math.max(0, st.hearts - 1);
  st.invuln = 1.5;
  st.streak = 0;
  st.anim = "hit";
  st.events.push("hit");
}

function announce(st: IslandState, text: string) {
  st.toast = { text, t: 2.4 };
}

/* ------------------------------ helpers ------------------------------- */

export function waveLabel(st: IslandState) {
  const def = WAVES[Math.min(WAVES.length, st.wave) - 1];
  return def ?? WAVES[0];
}

export function waveProgress(st: IslandState) {
  const elapsed = st.t * 1000;
  return (elapsed % WAVE_MS) / WAVE_MS;
}

/** True when the tile is currently unsafe because of the flood. */
export function tileFlooded(st: IslandState, tx: number, ty: number) {
  if (!st.flood.active || st.flood.rise <= 0.15) return false;
  const t = st.map.tiles[idx(tx, ty)];
  return ELEVATION[t] <= st.flood.level;
}

export function safeZoneActive(st: IslandState) {
  return st.flood.active && st.flood.rise > 0.05;
}

export { TILE, WORLD_H, WORLD_W };
