/**
 * YAJ Sugar Rush — maze-chase engine. Grid-buffered movement (classic "keep moving until
 * wall / intersection / new direction" maze feel — a genre-standard mechanic, not specific
 * to any one game) over the Candy City map, an original Sugar Meter / Sugar Rush Mode
 * mechanic, and a simple rule-based chaser (Dr. Cavity: PATROL / CHASE / SEARCH / RETREAT,
 * no pathfinding beyond plain BFS — no ML). Deterministic same as Tower Escape's engine:
 * same map + same inputs => same run.
 */

import {
  CandyCityMap,
  Cell,
  Dir,
  DELTA,
  DIRS,
  HazardZone,
  OPPOSITE,
  PowerupKind,
  buildCandyCity,
  cellCenter,
  cellIndex,
} from "./sugar-rush-map";

export const MAX_HEARTS = 3;
export const PLAYER_SPEED = 190;
export const CAVITY_BASE_SPEED = 158;
export const CAVITY_CHASE_SPEED = 182;
export const RUSH_DURATION = 7;
export const RUSH_SPEED_MUL = 1.55;
export const HIT_INVULN = 1.4;
export const STUN_DURATION = 3;
export const RECOVER_DURATION = 1.2;
export const SEARCH_DURATION = 5;
export const CHASE_RADIUS = 80 * 4.2;
export const LOSE_RADIUS = 80 * 6.6;
export const SYRUP_MUL = 0.55;
export const SOUR_DURATION = 3;
export const MAGNET_RADIUS = 80 * 2.2;
export const OBJECTIVE_TARGET = 3;

export type CavityMode = "patrol" | "chase" | "search" | "retreat" | "stunned" | "recover";

export type ActivePowerup = { kind: PowerupKind; timeLeft: number };

export type SugarRushStatus = "playing" | "complete" | "failed";

export type SugarRushEvent =
  | "pickup"
  | "sugarStar"
  | "powerUp"
  | "rushStart"
  | "rushEnd"
  | "tunnel"
  | "hit"
  | "shieldBlock"
  | "checkpoint"
  | "objectiveComplete"
  | "exitReached"
  | "cavityNear"
  | "cavityStunned";

type Mover = { from: Cell; to: Cell; edgeT: number; heading: Dir | null };

export type SugarRushMazeState = {
  map: CandyCityMap;
  status: SugarRushStatus;
  t: number;

  player: Mover;
  queuedHeading: Dir | null;
  hearts: number;
  checkpoint: number;
  checkpointCell: Cell;
  invuln: number;
  stunned: number;
  reversedControls: number;

  taken: Record<string, boolean>;
  treatsCollected: number;
  score: number;

  sugarMeter: number;
  rushActive: boolean;
  rushTimeLeft: number;
  rushActivations: number;

  objectiveProgress: number;
  objectiveTarget: number;
  objectiveLabel: string;
  exitUnlocked: boolean;

  activePowerups: ActivePowerup[];
  chocolateBlockOpen: Record<string, boolean>;
  cart: Mover & { dir: 1 | -1; pathIndex: number };

  cavity: Mover & {
    mode: CavityMode;
    lastKnownPlayerCell: Cell | null;
    searchTimer: number;
    stunTimer: number;
    recoverTimer: number;
    patrolIndex: number;
  };

  events: SugarRushEvent[];
};

export type SugarRushInput = { desired: Dir | null };
export const NO_INPUT: SugarRushInput = { desired: null };

function makeMover(cell: Cell): Mover {
  return { from: cell, to: cell, edgeT: 0, heading: null };
}

function moverPos(m: Mover) {
  const a = cellCenter(m.from);
  const b = cellCenter(m.to);
  return { x: a.x + (b.x - a.x) * m.edgeT, y: a.y + (b.y - a.y) * m.edgeT };
}

function isEdgeOpenStatic(map: CandyCityMap, cell: Cell, dir: Dir): boolean {
  return map.cells[cellIndex(cell.c, cell.r)].open[dir];
}

function chocolateBlockFor(map: CandyCityMap, a: Cell, b: Cell): Extract<HazardZone, { kind: "chocolateBlock" }> | null {
  for (const h of map.hazards) {
    if (h.kind !== "chocolateBlock") continue;
    if ((h.a.c === a.c && h.a.r === a.r && h.b.c === b.c && h.b.r === b.r) ||
        (h.a.c === b.c && h.a.r === b.r && h.b.c === a.c && h.b.r === a.r)) {
      return h;
    }
  }
  return null;
}

function isEdgeOpen(st: SugarRushMazeState, cell: Cell, dir: Dir): boolean {
  if (!isEdgeOpenStatic(st.map, cell, dir)) return false;
  const { dc, dr } = DELTA[dir];
  const neighbor = { c: cell.c + dc, r: cell.r + dr };
  const block = chocolateBlockFor(st.map, cell, neighbor);
  if (block && st.chocolateBlockOpen[block.id] === false) return false;
  return true;
}

function neighborCell(cell: Cell, dir: Dir): Cell {
  const { dc, dr } = DELTA[dir];
  return { c: cell.c + dc, r: cell.r + dr };
}

function findTunnel(map: CandyCityMap, cell: Cell) {
  for (const tp of map.tunnels) {
    if (tp.a.c === cell.c && tp.a.r === cell.r) return { pair: tp, other: tp.b };
    if (tp.b.c === cell.c && tp.b.r === cell.r) return { pair: tp, other: tp.a };
  }
  return null;
}

export function initialSugarRushMaze(): SugarRushMazeState {
  const map = buildCandyCity();
  const chocolateBlockOpen: Record<string, boolean> = {};
  for (const h of map.hazards) if (h.kind === "chocolateBlock") chocolateBlockOpen[h.id] = true;

  return {
    map,
    status: "playing",
    t: 0,
    player: makeMover(map.start),
    queuedHeading: null,
    hearts: MAX_HEARTS,
    checkpoint: 0,
    checkpointCell: map.start,
    invuln: 0,
    stunned: 0,
    reversedControls: 0,
    taken: {},
    treatsCollected: 0,
    score: 0,
    sugarMeter: 0,
    rushActive: false,
    rushTimeLeft: 0,
    rushActivations: 0,
    objectiveProgress: 0,
    objectiveTarget: OBJECTIVE_TARGET,
    objectiveLabel: "Find 3 Frosting Gems",
    exitUnlocked: false,
    activePowerups: [],
    chocolateBlockOpen,
    cart: { ...makeMover(map.cartPath[0] ?? map.start), dir: 1, pathIndex: 0 },
    cavity: {
      ...makeMover(map.cavitySpawn),
      mode: "patrol",
      lastKnownPlayerCell: null,
      searchTimer: 0,
      stunTimer: 0,
      recoverTimer: 0,
      patrolIndex: 0,
    },
    events: [],
  };
}

const STEP = 1 / 60;

export function step(state: SugarRushMazeState, input: SugarRushInput, dtMs: number): SugarRushMazeState {
  if (state.status !== "playing") return state;
  const st: SugarRushMazeState = { ...state, events: [] };
  let left = Math.min(dtMs, 120);
  while (left > 0) {
    const dt = Math.min(STEP, left / 1000);
    tick(st, input, dt);
    left -= dt * 1000;
    if (st.status !== "playing") break;
  }
  return st;
}

function tick(st: SugarRushMazeState, input: SugarRushInput, dt: number) {
  st.t += dt;

  const effectiveDesired = st.reversedControls > 0 && input.desired ? OPPOSITE[input.desired] : input.desired;
  if (effectiveDesired) st.queuedHeading = effectiveDesired;

  if (st.invuln > 0) st.invuln = Math.max(0, st.invuln - dt);
  if (st.stunned > 0) st.stunned = Math.max(0, st.stunned - dt);
  if (st.reversedControls > 0) st.reversedControls = Math.max(0, st.reversedControls - dt);

  for (const p of st.activePowerups) p.timeLeft -= dt;
  st.activePowerups = st.activePowerups.filter((p) => p.timeLeft > 0);

  tickChocolateBlocks(st, dt);
  tickCart(st, dt);

  if (st.stunned <= 0) {
    const speedMul =
      (st.rushActive ? RUSH_SPEED_MUL : 1) *
      (activeKind(st, "speed") ? 1.35 : 1) *
      (inSyrup(st, st.player.to) ? SYRUP_MUL : 1);
    movePlayer(st, dt, PLAYER_SPEED * speedMul);
  }

  if (activeKind(st, "magnet")) applyMagnet(st);

  tickRush(st, dt);
  tickCavity(st, dt);
  checkCartCollision(st);
  checkCavityCollision(st);

  finishCheck(st);
}

function activeKind(st: SugarRushMazeState, kind: PowerupKind) {
  return st.activePowerups.some((p) => p.kind === kind);
}

function inSyrup(st: SugarRushMazeState, cell: Cell) {
  return st.map.hazards.some((h) => h.kind === "syrup" && h.cells.some((c) => c.c === cell.c && c.r === cell.r));
}

function tickChocolateBlocks(st: SugarRushMazeState, _dt: number) {
  for (const h of st.map.hazards) {
    if (h.kind !== "chocolateBlock") continue;
    const cycle = h.onSec + h.offSec;
    const at = (st.t + h.phase * cycle) % cycle;
    st.chocolateBlockOpen[h.id] = at < h.onSec;
  }
}

function tickCart(st: SugarRushMazeState, dt: number) {
  const path = st.map.cartPath;
  if (path.length < 2) return;
  const CART_SPEED = 130;
  st.cart.edgeT += (CART_SPEED * dt) / st.map.cellSize;
  while (st.cart.edgeT >= 1) {
    st.cart.edgeT -= 1;
    let next = st.cart.pathIndex + st.cart.dir;
    if (next >= path.length || next < 0) {
      st.cart.dir = (st.cart.dir * -1) as 1 | -1;
      next = st.cart.pathIndex + st.cart.dir;
    }
    st.cart.from = st.cart.to;
    st.cart.to = path[Math.max(0, Math.min(path.length - 1, next))];
    st.cart.pathIndex = next;
  }
}

function movePlayer(st: SugarRushMazeState, dt: number, speed: number) {
  const mover = st.player;
  if (mover.heading === null) {
    if (st.queuedHeading && isEdgeOpen(st, mover.to, st.queuedHeading)) {
      mover.heading = st.queuedHeading;
      mover.from = mover.to;
      mover.to = neighborCell(mover.to, st.queuedHeading);
      mover.edgeT = 0;
    } else {
      return;
    }
  }

  mover.edgeT += (speed * dt) / st.map.cellSize;
  if (mover.edgeT >= 1) {
    mover.edgeT = 1;
    const arrived = mover.to;
    mover.from = arrived;

    onArrive(st, arrived);
    if (st.status !== "playing") return;

    const tunnel = findTunnel(st.map, arrived);
    if (tunnel) {
      mover.from = tunnel.other;
      mover.to = tunnel.other;
      mover.edgeT = 0;
      mover.heading = null;
      st.events.push("tunnel");
      return;
    }

    const candidate =
      st.queuedHeading && isEdgeOpen(st, arrived, st.queuedHeading)
        ? st.queuedHeading
        : mover.heading && isEdgeOpen(st, arrived, mover.heading)
          ? mover.heading
          : null;

    if (candidate) {
      mover.heading = candidate;
      mover.to = neighborCell(arrived, candidate);
      mover.edgeT = 0;
    } else {
      mover.heading = null;
      mover.to = arrived;
      mover.edgeT = 0;
    }
  }
}

function onArrive(st: SugarRushMazeState, cell: Cell) {
  collectAt(st, cell);
  checkpointAt(st, cell);
}

function collectAt(st: SugarRushMazeState, cell: Cell) {
  for (const item of st.map.collectibles) {
    if (item.c !== cell.c || item.r !== cell.r) continue;
    if (st.taken[item.id]) continue;
    st.taken[item.id] = true;
    st.treatsCollected += 1;
    const meterGain =
      item.kind === "gummy" ? 4 : item.kind === "candyDrop" ? 6 : item.kind === "donutToken" ? 10 : item.kind === "sugarStar" ? 15 : 20;
    const scoreGain =
      (item.kind === "gummy" ? 20 : item.kind === "candyDrop" ? 35 : item.kind === "donutToken" ? 60 : item.kind === "sugarStar" ? 90 : 150) *
      (st.rushActive ? 2 : 1);
    st.sugarMeter = Math.min(100, st.sugarMeter + meterGain);
    st.score += scoreGain;
    st.events.push(item.kind === "sugarStar" ? "sugarStar" : "pickup");
    if (item.kind === "frostingGem") {
      st.objectiveProgress = Math.min(st.objectiveTarget, st.objectiveProgress + 1);
      if (st.objectiveProgress >= st.objectiveTarget && !st.exitUnlocked) {
        st.exitUnlocked = true;
        st.events.push("objectiveComplete");
      }
    }
  }
  for (const pu of st.map.powerups) {
    if (pu.c !== cell.c || pu.r !== cell.r) continue;
    if (st.taken[pu.id]) continue;
    st.taken[pu.id] = true;
    const duration = pu.kind === "shield" ? 9999 : pu.kind === "speed" ? 6 : pu.kind === "freeze" ? 5 : 8;
    st.activePowerups.push({ kind: pu.kind, timeLeft: duration });
    st.score += 40;
    st.events.push("powerUp");
  }
  const sour = st.map.hazards.find((h) => h.kind === "sourPatch" && h.cells.some((c) => c.c === cell.c && c.r === cell.r));
  if (sour && st.reversedControls <= 0) st.reversedControls = SOUR_DURATION;
}

function checkpointAt(st: SugarRushMazeState, cell: Cell) {
  for (const cp of st.map.checkpoints) {
    if (cp.index <= st.checkpoint) continue;
    if (cp.c === cell.c && cp.r === cell.r) {
      st.checkpoint = cp.index;
      st.checkpointCell = { c: cp.c, r: cp.r };
      st.score += 100;
      st.events.push("checkpoint");
    }
  }
}

function applyMagnet(st: SugarRushMazeState) {
  const pos = moverPos(st.player);
  for (const item of st.map.collectibles) {
    if (st.taken[item.id]) continue;
    const c = cellCenter(item);
    if (Math.hypot(c.x - pos.x, c.y - pos.y) <= MAGNET_RADIUS) collectAt(st, { c: item.c, r: item.r });
  }
}

function tickRush(st: SugarRushMazeState, dt: number) {
  if (!st.rushActive && st.sugarMeter >= 100) {
    st.rushActive = true;
    st.rushTimeLeft = RUSH_DURATION;
    st.sugarMeter = 0;
    st.rushActivations += 1;
    st.events.push("rushStart");
  }
  if (st.rushActive) {
    st.rushTimeLeft -= dt;
    if (st.rushTimeLeft <= 0) {
      st.rushActive = false;
      st.rushTimeLeft = 0;
      st.events.push("rushEnd");
    }
  }
}

/* ── Dr. Cavity: simple rule-based state machine, plain BFS pathfinding only ────────── */

function bfsNextDir(st: SugarRushMazeState, from: Cell, to: Cell): Dir | null {
  if (from.c === to.c && from.r === to.r) return null;
  const map = st.map;
  const startIdx = cellIndex(from.c, from.r);
  const goalIdx = cellIndex(to.c, to.r);
  const cameFrom = new Map<number, { prev: number; dir: Dir }>();
  const visited = new Set<number>([startIdx]);
  const queue: Cell[] = [from];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const curIdx = cellIndex(cur.c, cur.r);
    if (curIdx === goalIdx) break;
    for (const d of DIRS) {
      if (!isEdgeOpen(st, cur, d)) continue;
      const nb = neighborCell(cur, d);
      const nbIdx = cellIndex(nb.c, nb.r);
      if (visited.has(nbIdx)) continue;
      visited.add(nbIdx);
      cameFrom.set(nbIdx, { prev: curIdx, dir: d });
      queue.push(nb);
    }
  }
  if (!visited.has(goalIdx)) return null;
  // Walk back from goal to start, remembering the first step's direction.
  let cur = goalIdx;
  let firstDir: Dir | null = null;
  while (cur !== startIdx) {
    const step = cameFrom.get(cur);
    if (!step) return null;
    firstDir = step.dir;
    cur = step.prev;
  }
  return firstDir;
}

/** Greedy "back away" step for RETREAT — picks whichever open neighbor most increases
 *  distance from the player, no full pathfinding needed for fleeing. */
function fleeDir(st: SugarRushMazeState, from: Cell, away: Cell): Dir | null {
  let best: Dir | null = null;
  let bestDist = -Infinity;
  for (const d of DIRS) {
    if (!isEdgeOpen(st, from, d)) continue;
    const nb = neighborCell(from, d);
    const dist = Math.hypot(nb.c - away.c, nb.r - away.r);
    if (dist > bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function tickCavity(st: SugarRushMazeState, dt: number) {
  const cav = st.cavity;
  const playerCell = distanceReferenceCell(st.player);
  const playerPos = moverPos(st.player);
  const cavPos = moverPos(cav);
  const dist = Math.hypot(playerPos.x - cavPos.x, playerPos.y - cavPos.y);

  if (cav.stunTimer > 0) {
    cav.stunTimer = Math.max(0, cav.stunTimer - dt);
    if (cav.stunTimer <= 0) {
      cav.mode = "recover";
      cav.recoverTimer = RECOVER_DURATION;
    }
    return; // frozen in place while stunned
  }
  if (cav.recoverTimer > 0) {
    cav.recoverTimer = Math.max(0, cav.recoverTimer - dt);
    if (cav.recoverTimer <= 0) cav.mode = "patrol";
  }

  if (st.rushActive) {
    cav.mode = "retreat";
  } else if (cav.mode === "retreat") {
    cav.mode = dist < CHASE_RADIUS ? "chase" : "patrol";
  } else if (cav.mode === "patrol" && dist < CHASE_RADIUS) {
    cav.mode = "chase";
  } else if (cav.mode === "chase" && dist > LOSE_RADIUS) {
    cav.mode = "search";
    cav.searchTimer = SEARCH_DURATION;
    cav.lastKnownPlayerCell = playerCell;
  } else if (cav.mode === "search") {
    cav.searchTimer -= dt;
    if (dist < CHASE_RADIUS) cav.mode = "chase";
    else if (cav.searchTimer <= 0) cav.mode = "patrol";
  }

  const base = cav.mode === "chase" ? CAVITY_CHASE_SPEED : CAVITY_BASE_SPEED;
  const speed = base * (activeKind(st, "freeze") ? 0.35 : 1);
  moveCavity(st, dt, speed, playerCell);
}

function distanceReferenceCell(m: Mover): Cell {
  return m.edgeT > 0.5 ? m.to : m.from;
}

function moveCavity(st: SugarRushMazeState, dt: number, speed: number, playerCell: Cell) {
  const cav = st.cavity;

  if (cav.heading === null) {
    const dir = pickCavityDir(st, cav.to, playerCell);
    if (dir) {
      cav.heading = dir;
      cav.from = cav.to;
      cav.to = neighborCell(cav.to, dir);
      cav.edgeT = 0;
    } else {
      return;
    }
  }

  cav.edgeT += (speed * dt) / st.map.cellSize;
  if (cav.edgeT >= 1) {
    cav.edgeT = 1;
    const arrived = cav.to;
    cav.from = arrived;

    if (cav.mode === "patrol" && cellsEqual(arrived, patrolTarget(st.map, cav.patrolIndex))) {
      cav.patrolIndex = (cav.patrolIndex + 1) % PATROL_WAYPOINTS.length;
    }

    const dir = pickCavityDir(st, arrived, playerCell);
    if (dir) {
      cav.heading = dir;
      cav.to = neighborCell(arrived, dir);
      cav.edgeT = 0;
    } else {
      cav.heading = null;
      cav.to = arrived;
      cav.edgeT = 0;
    }
  }
}

// Kept well clear of the player's start cell (1,1) so a fresh run never opens with Dr.
// Cavity beelining toward a point right next to the player before they've had a chance
// to move — every waypoint here is comfortably outside CHASE_RADIUS from spawn.
const PATROL_WAYPOINTS: Cell[] = [
  { c: 11, r: 3 },
  { c: 12, r: 15 },
  { c: 3, r: 16 },
  { c: 9, r: 9 },
];

function patrolTarget(map: CandyCityMap, index: number): Cell {
  const wp = PATROL_WAYPOINTS[index % PATROL_WAYPOINTS.length];
  return { c: Math.min(map.cols - 1, wp.c), r: Math.min(map.rows - 1, wp.r) };
}

function cellsEqual(a: Cell, b: Cell) {
  return a.c === b.c && a.r === b.r;
}

function pickCavityDir(st: SugarRushMazeState, from: Cell, playerCell: Cell): Dir | null {
  const cav = st.cavity;
  if (cav.mode === "chase") return bfsNextDir(st, from, playerCell);
  if (cav.mode === "search" && cav.lastKnownPlayerCell) return bfsNextDir(st, from, cav.lastKnownPlayerCell);
  if (cav.mode === "retreat") return fleeDir(st, from, playerCell);
  return bfsNextDir(st, from, patrolTarget(st.map, cav.patrolIndex));
}

function checkCavityCollision(st: SugarRushMazeState) {
  const playerPos = moverPos(st.player);
  const cavPos = moverPos(st.cavity);
  const dist = Math.hypot(playerPos.x - cavPos.x, playerPos.y - cavPos.y);
  const CATCH_RADIUS = st.map.cellSize * 0.55;
  if (dist > CATCH_RADIUS) {
    if (dist < CHASE_RADIUS * 1.15 && st.cavity.mode === "chase") st.events.push("cavityNear");
    return;
  }

  if (st.rushActive && st.cavity.mode !== "stunned" && st.cavity.stunTimer <= 0) {
    st.cavity.mode = "stunned";
    st.cavity.stunTimer = STUN_DURATION;
    st.score += 300;
    st.events.push("cavityStunned");
    return;
  }

  if (st.invuln > 0 || st.rushActive || st.cavity.mode === "stunned" || st.cavity.mode === "recover") return;
  damage(st);
}

function checkCartCollision(st: SugarRushMazeState) {
  if (st.invuln > 0 || st.rushActive) return;
  const playerPos = moverPos(st.player);
  const cartPos = moverPos(st.cart);
  if (Math.hypot(playerPos.x - cartPos.x, playerPos.y - cartPos.y) <= st.map.cellSize * 0.5) damage(st);
}

function damage(st: SugarRushMazeState) {
  const shieldIndex = st.activePowerups.findIndex((p) => p.kind === "shield");
  if (shieldIndex >= 0) {
    st.activePowerups.splice(shieldIndex, 1);
    st.invuln = HIT_INVULN;
    st.events.push("shieldBlock");
    return;
  }
  st.hearts -= 1;
  st.events.push("hit");
  if (st.hearts <= 0) {
    st.status = "failed";
    return;
  }
  respawnPlayer(st);
}

function respawnPlayer(st: SugarRushMazeState) {
  st.player = makeMover(st.checkpointCell);
  st.queuedHeading = null;
  st.invuln = HIT_INVULN;
  st.stunned = 0.5;
}

function finishCheck(st: SugarRushMazeState) {
  const at = distanceReferenceCell(st.player);
  if (st.exitUnlocked && st.player.edgeT === 0 && at.c === st.map.exit.c && at.r === st.map.exit.r) {
    st.status = "complete";
    st.events.push("exitReached");
  }
}

/** Retry from the last checkpoint with a fresh heart bar — used after a "failed" run if
 *  the page offers a checkpoint retry instead of ending immediately. */
export function retryFromCheckpoint(st: SugarRushMazeState): SugarRushMazeState {
  const next: SugarRushMazeState = { ...st, status: "playing", hearts: MAX_HEARTS, events: [] };
  respawnPlayer(next);
  return next;
}

export function playerWorldPos(st: SugarRushMazeState) {
  return moverPos(st.player);
}

export function cavityWorldPos(st: SugarRushMazeState) {
  return moverPos(st.cavity);
}

export function cartWorldPos(st: SugarRushMazeState) {
  return moverPos(st.cart);
}

export type SugarRushScore = {
  score: number;
  treatsCollected: number;
  rushActivations: number;
  elapsedMs: number;
  heartsRemaining: number;
};

export function scoreRun(st: SugarRushMazeState): SugarRushScore {
  return {
    score: st.score,
    treatsCollected: st.treatsCollected,
    rushActivations: st.rushActivations,
    elapsedMs: Math.round(st.t * 1000),
    heartsRemaining: st.hearts,
  };
}
