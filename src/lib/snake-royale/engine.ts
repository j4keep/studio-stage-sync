/**
 * YAJ Snake Royale — deterministic jungle-survival engine.
 *
 * Free-roam continuous movement (no grid/maze), mirroring Survival Island's engine
 * shape exactly: movement/collision, hazard ticking, health/stars/objectives, timer +
 * score all in one step() driven by a fixed-step-friendly dtMs. Snakes are the one
 * hazard archetype Survival Island doesn't have — a den-anchored wander/strike state
 * machine, see tickDens/tickSnakes below.
 */

import {
  DenSpot,
  GRID_H,
  GRID_W,
  JungleMap,
  TILE,
  WORLD_H,
  WORLD_W,
  buildJungle,
  idx,
  mulberry32,
  tileCenter,
  walkable,
} from "./map";
import {
  DEN_AWARENESS_RANGE,
  EMERGE_DURATION,
  ImpactHazard,
  MAX_ACTIVE_IMPACTS,
  MAX_ACTIVE_SNAKES,
  RETREAT_DURATION,
  SNAKE_R,
  STRIKE_LOSE_RANGE,
  STRIKE_LUNGE,
  STRIKE_RANGE,
  STRIKE_WINDUP,
  SnakeHazard,
  WANDER_RADIUS,
  WAVES,
  WAVE_MS,
  branchInterval,
  denCooldown,
  isCrocWater,
  isMud,
  rockInterval,
  spawnImpact,
  spawnSnake,
  waveFor,
} from "./hazards";

export const RUN_MS = 150_000; // 2:30 timed run, matches Survival Island's length
export const MAX_HEARTS = 3;
export const PLAYER_R = 15;
const BASE_SPEED = 205;
const MUD_SPEED_MUL = 0.6;
const ACCEL = 12;
const CROC_TICK_S = 1.5;
const THORN_TICK_S = 0.8;
const SNAKE_WANDER_SPEED = 70;

export type SnakeEvent =
  | "star"
  | "heart"
  | "hiss"
  | "strike"
  | "hit"
  | "splash"
  | "mud"
  | "rock"
  | "branch"
  | "warn"
  | "wave"
  | "objective"
  | "timer";

export type SnakeAnim = "idle" | "run" | "hit" | "wade" | "celebrate";

export type Star = { x: number; y: number; taken: boolean; respawn: number };
export type Objective = { id: string; label: string; target: number; progress: number; done: boolean };

export type SnakeInput = { mx: number; my: number };
export const NO_INPUT: SnakeInput = { mx: 0, my: 0 };

export type SnakeRoyaleState = {
  map: JungleMap;
  rnd: () => number;
  t: number;
  timeLeft: number;
  /** Solo mode: endless jungle run — no win-by-timer, only hearts or a manual quit end it. */
  endless: boolean;
  status: "alive" | "survived" | "over";
  hearts: number;
  invuln: number;
  stars: number;
  score: number;
  dodged: number;
  streak: number;
  bestStreak: number;
  wave: number;
  waveFlash: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Last position on dry, non-hazardous ground — where a croc-water bite spits the
   *  player back out to, so standing at a river's edge can't chain-damage forever. */
  safeX: number;
  safeY: number;
  facing: 1 | -1;
  anim: SnakeAnim;
  snakes: SnakeHazard[];
  impacts: ImpactHazard[];
  denCooldowns: number[];
  starList: Star[];
  objectives: Objective[];
  nextRock: number;
  nextBranch: number;
  thornCooldown: number;
  crocTimer: number;
  events: SnakeEvent[];
  toast: { text: string; t: number } | null;
};

const OBJECTIVE_POOL: Omit<Objective, "progress" | "done">[] = [
  { id: "stars10", label: "Collect 10 stars", target: 10 },
  { id: "temple", label: "Reach the temple gate", target: 1 },
  { id: "bridge", label: "Cross the bridge", target: 1 },
  { id: "dodge3", label: "Dodge 3 hazards in a row", target: 3 },
  { id: "survive60", label: "Survive the jungle", target: 60 },
];

export function initialSnakeRoyale(seed = Math.floor(Math.random() * 1_000_000), endless = false): SnakeRoyaleState {
  const map = buildJungle(20260822);
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
    dodged: 0,
    streak: 0,
    bestStreak: 0,
    wave: 1,
    waveFlash: 2.6,
    x: map.spawn.x,
    y: map.spawn.y,
    vx: 0,
    vy: 0,
    safeX: map.spawn.x,
    safeY: map.spawn.y,
    facing: 1,
    anim: "idle",
    snakes: [],
    impacts: [],
    denCooldowns: map.denSpots.map((_, i) => (i % 5) * 0.6),
    starList: map.starSpots.map((s) => ({ x: s.x, y: s.y, taken: false, respawn: 0 })),
    objectives,
    nextRock: 4,
    nextBranch: 3,
    thornCooldown: 0,
    crocTimer: 0,
    events: [],
    toast: null,
  };
}

export function step(st: SnakeRoyaleState, input: SnakeInput, dtMs: number): SnakeRoyaleState {
  if (st.status !== "alive") return st;
  const dt = Math.min(0.05, dtMs / 1000);
  st.events = [];
  st.t += dt;

  const prevSecond = Math.ceil(st.timeLeft / 1000);
  if (!st.endless) st.timeLeft = Math.max(0, st.timeLeft - dtMs);
  const nowSecond = Math.ceil(st.timeLeft / 1000);
  if (!st.endless && nowSecond !== prevSecond && nowSecond <= 10 && nowSecond > 0) st.events.push("timer");

  const wave = waveFor(st.t * 1000);
  if (wave !== st.wave) {
    st.wave = wave;
    st.waveFlash = 2.6;
    st.events.push("wave");
  }
  st.waveFlash = Math.max(0, st.waveFlash - dt);
  st.invuln = Math.max(0, st.invuln - dt);
  st.thornCooldown = Math.max(0, st.thornCooldown - dt);
  if (st.toast) {
    st.toast.t -= dt;
    if (st.toast.t <= 0) st.toast = null;
  }

  movePlayer(st, input, dt);
  tickDens(st, dt);
  tickSnakes(st, dt);
  tickImpacts(st, dt, wave);
  tickZones(st, dt);
  tickStars(st, dt);
  tickObjectives(st);

  st.score = Math.floor(st.t) * 10 + st.stars * 120 + st.dodged * 30 + st.objectives.filter((o) => o.done).length * 300;

  if (st.hearts <= 0) {
    st.status = "over";
  } else if (!st.endless && st.timeLeft <= 0) {
    st.status = "survived";
    st.anim = "celebrate";
  }
  return st;
}

/* ------------------------------- player ------------------------------- */

function movePlayer(st: SnakeRoyaleState, input: SnakeInput, dt: number) {
  const mag = Math.hypot(input.mx, input.my);
  const mud = isMud(st.map, st.x, st.y);
  const speed = BASE_SPEED * (mud ? MUD_SPEED_MUL : 1);

  let tx = 0;
  let ty = 0;
  if (mag > 0.08) {
    const n = Math.min(1, mag);
    tx = (input.mx / mag) * n * speed;
    ty = (input.my / mag) * n * speed;
  }

  st.vx += (tx - st.vx) * Math.min(1, ACCEL * dt);
  st.vy += (ty - st.vy) * Math.min(1, ACCEL * dt);
  if (Math.abs(st.vx) > 6) st.facing = st.vx > 0 ? 1 : -1;

  slide(st, st.vx * dt, 0);
  slide(st, 0, st.vy * dt);

  if (!isCrocWater(st.map, st.x, st.y)) {
    st.safeX = st.x;
    st.safeY = st.y;
  }

  const moving = Math.hypot(st.vx, st.vy) > 26;
  if (st.invuln > 0.75) st.anim = "hit";
  else if (mud) st.anim = moving ? "wade" : "idle";
  else st.anim = moving ? "run" : "idle";
}

function slide(st: SnakeRoyaleState, dx: number, dy: number) {
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

function blocked(st: SnakeRoyaleState, x: number, y: number) {
  for (const [ox, oy] of [
    [PLAYER_R * 0.7, 0],
    [-PLAYER_R * 0.7, 0],
    [0, PLAYER_R * 0.6],
    [0, -PLAYER_R * 0.6],
  ]) {
    if (!walkable(st.map, x + ox, y + oy)) return true;
  }
  for (const p of st.map.props) {
    if (p.solid <= 0) continue;
    if (Math.hypot(x - p.x, y - p.y) < p.solid * 0.8 + PLAYER_R * 0.55) return true;
  }
  return false;
}

/* -------------------------------- dens --------------------------------- */

function tickDens(st: SnakeRoyaleState, dt: number) {
  const capacity = Math.min(MAX_ACTIVE_SNAKES, 1 + st.wave);
  if (st.snakes.length >= capacity) {
    for (let i = 0; i < st.denCooldowns.length; i++) st.denCooldowns[i] = Math.max(0, st.denCooldowns[i] - dt);
    return;
  }
  for (let i = 0; i < st.map.denSpots.length; i++) {
    st.denCooldowns[i] = Math.max(0, st.denCooldowns[i] - dt);
    if (st.denCooldowns[i] > 0) continue;
    if (st.snakes.some((s) => s.denIndex === i)) continue;
    const den = st.map.denSpots[i];
    const d = Math.hypot(st.x - den.x, st.y - den.y);
    if (d > DEN_AWARENESS_RANGE || d < STRIKE_RANGE * 0.6) continue;
    st.snakes.push(spawnSnake(den, i));
    st.events.push("hiss");
    if (st.snakes.length >= capacity) break;
  }
}

/* ------------------------------- snakes --------------------------------- */

function tickSnakes(st: SnakeRoyaleState, dt: number) {
  for (const sn of st.snakes) {
    sn.t += dt;
    const distToPlayer = Math.hypot(st.x - sn.x, st.y - sn.y);

    if (sn.state === "emerging") {
      if (sn.t >= EMERGE_DURATION) {
        sn.state = "active";
        sn.t = 0;
        pickWanderTarget(sn, st.rnd);
      }
      continue;
    }

    if (sn.state === "active") {
      const wd = Math.hypot(sn.wanderTx - sn.x, sn.wanderTy - sn.y);
      if (wd < 6) pickWanderTarget(sn, st.rnd);
      const ang = Math.atan2(sn.wanderTy - sn.y, sn.wanderTx - sn.x);
      sn.x += Math.cos(ang) * SNAKE_WANDER_SPEED * dt;
      sn.y += Math.sin(ang) * SNAKE_WANDER_SPEED * dt;
      sn.angle = ang;

      if (distToPlayer < STRIKE_RANGE) {
        sn.state = "striking";
        sn.t = 0;
        sn.angle = Math.atan2(st.y - sn.y, st.x - sn.x);
        st.events.push("hiss");
      } else if (distToPlayer > DEN_AWARENESS_RANGE) {
        sn.state = "retreating";
        sn.t = 0;
      }
      continue;
    }

    if (sn.state === "striking") {
      if (sn.t < STRIKE_WINDUP) {
        // telegraph — coiled, no movement yet.
      } else if (sn.t < STRIKE_WINDUP + STRIKE_LUNGE) {
        if (sn.t - dt < STRIKE_WINDUP) st.events.push("strike");
        const lungeSpeed = (STRIKE_RANGE * 1.4) / STRIKE_LUNGE;
        sn.x += Math.cos(sn.angle) * lungeSpeed * dt;
        sn.y += Math.sin(sn.angle) * lungeSpeed * dt;
        if (!sn.hitPlayer && distToPlayer < SNAKE_R + PLAYER_R) {
          sn.hitPlayer = true;
          damage(st);
        }
      } else {
        sn.hitPlayer = false;
        sn.state = distToPlayer < STRIKE_LOSE_RANGE ? "active" : "retreating";
        sn.t = 0;
        if (sn.state === "active") pickWanderTarget(sn, st.rnd);
      }
      continue;
    }

    if (sn.state === "retreating") {
      const ang = Math.atan2(sn.denY - sn.y, sn.denX - sn.x);
      sn.angle = ang;
      const d = Math.hypot(sn.denX - sn.x, sn.denY - sn.y);
      if (d > 4) {
        sn.x += Math.cos(ang) * SNAKE_WANDER_SPEED * 1.3 * dt;
        sn.y += Math.sin(ang) * SNAKE_WANDER_SPEED * 1.3 * dt;
      }
      if (d <= 4 || sn.t > RETREAT_DURATION * 3) {
        st.denCooldowns[sn.denIndex] = denCooldown(st.wave, st.rnd);
        sn.t = -1; // marks for removal below
      }
    }
  }
  st.snakes = st.snakes.filter((s) => s.t >= 0);
}

function pickWanderTarget(sn: SnakeHazard, rnd: () => number) {
  const a = rnd() * Math.PI * 2;
  const r = rnd() * WANDER_RADIUS;
  sn.wanderTx = sn.denX + Math.cos(a) * r;
  sn.wanderTy = sn.denY + Math.sin(a) * r;
}

/* --------------------------- rocks & branches ---------------------------- */

function tickImpacts(st: SnakeRoyaleState, dt: number, wave: number) {
  st.nextRock -= dt;
  if (st.nextRock <= 0) {
    st.nextRock = rockInterval(wave);
    if (st.impacts.length < MAX_ACTIVE_IMPACTS) {
      const hz = spawnImpact(st.map, "rock", st.rnd);
      if (hz) {
        st.impacts.push(hz);
        st.events.push("warn");
      }
    }
  }
  st.nextBranch -= dt;
  if (st.nextBranch <= 0) {
    st.nextBranch = branchInterval(wave);
    if (st.impacts.length < MAX_ACTIVE_IMPACTS) {
      const hz = spawnImpact(st.map, "branch", st.rnd);
      if (hz) {
        st.impacts.push(hz);
        st.events.push("warn");
      }
    }
  }

  for (const hz of st.impacts) {
    if (!hz.impacted) {
      hz.warn -= dt;
      if (hz.warn <= 0) {
        hz.impacted = true;
        st.events.push(hz.kind === "rock" ? "rock" : "branch");
        const hit = Math.hypot(st.x - hz.x, st.y - hz.y) < hz.radius;
        if (hit) {
          hz.hitPlayer = true;
          damage(st);
        } else {
          st.dodged++;
          st.streak++;
          st.bestStreak = Math.max(st.bestStreak, st.streak);
        }
      }
    } else {
      hz.age += dt;
    }
  }
  st.impacts = st.impacts.filter((h) => !h.impacted || h.age < 0.7);
}

/* ------------------------------ zones ------------------------------------ */

function tickZones(st: SnakeRoyaleState, dt: number) {
  if (isCrocWater(st.map, st.x, st.y)) {
    st.crocTimer += dt;
    if (st.crocTimer >= CROC_TICK_S) {
      st.crocTimer = 0;
      st.events.push("splash");
      if (damage(st)) {
        // Spat back out well clear of the water, not just to the literal last dry
        // pixel — otherwise holding a direction into a river edge would walk straight
        // back in and re-trigger this on the very next tick. A longer invuln window on
        // top of that gives a real beat to react before it can happen again.
        const away = Math.atan2(st.safeY - st.y, st.safeX - st.x);
        const kx = st.safeX + Math.cos(away) * 40;
        const ky = st.safeY + Math.sin(away) * 40;
        if (!blocked(st, kx, ky)) {
          st.x = kx;
          st.y = ky;
        } else {
          st.x = st.safeX;
          st.y = st.safeY;
        }
        st.vx = 0;
        st.vy = 0;
        st.invuln = Math.max(st.invuln, 2.2);
      }
    }
  } else {
    st.crocTimer = 0;
  }

  if (isMud(st.map, st.x, st.y) && Math.hypot(st.vx, st.vy) > 20) {
    if (st.rnd() < dt * 0.6) st.events.push("mud");
  }

  if (st.thornCooldown <= 0) {
    for (const p of st.map.props) {
      if (p.kind !== "bush") continue;
      if (Math.hypot(st.x - p.x, st.y - p.y) < p.solid + 10) {
        st.thornCooldown = THORN_TICK_S;
        st.events.push("hit");
        break;
      }
    }
  }
}

/* --------------------------- collectibles ------------------------------- */

function tickStars(st: SnakeRoyaleState, dt: number) {
  for (const s of st.starList) {
    if (s.taken) {
      s.respawn -= dt;
      if (s.respawn <= 0) s.taken = false;
      continue;
    }
    if (Math.hypot(st.x - s.x, st.y - s.y) < PLAYER_R + 16) {
      s.taken = true;
      s.respawn = 24;
      st.stars++;
      st.events.push("star");
    }
  }
}

function tickObjectives(st: SnakeRoyaleState) {
  for (const o of st.objectives) {
    if (o.done) continue;
    if (o.id === "stars10") o.progress = st.stars;
    else if (o.id === "dodge3") o.progress = st.bestStreak;
    else if (o.id === "survive60") o.progress = Math.min(o.target, Math.floor(st.t));
    else if (o.id === "temple" && Math.hypot(st.x - st.map.temple.x, st.y - st.map.temple.y) < st.map.temple.r)
      o.progress = 1;
    else if (o.id === "bridge" && st.map.bridgeTiles.includes(bridgeIndexAt(st.x, st.y))) o.progress = 1;
    if (o.progress >= o.target) {
      o.done = true;
      st.events.push("objective");
      announce(st, `Bonus complete — ${o.label}`);
    }
  }
}

function bridgeIndexAt(x: number, y: number) {
  return idx(Math.floor(x / TILE), Math.floor(y / TILE));
}

/* ------------------------------ health -------------------------------- */

function damage(st: SnakeRoyaleState): boolean {
  if (st.invuln > 0) return false;
  st.hearts = Math.max(0, st.hearts - 1);
  st.invuln = 1.4;
  st.streak = 0;
  st.anim = "hit";
  st.events.push("hit");
  return true;
}

function announce(st: SnakeRoyaleState, text: string) {
  st.toast = { text, t: 2.4 };
}

/* ------------------------------ helpers ------------------------------- */

export function waveLabel(st: SnakeRoyaleState) {
  const def = WAVES[Math.min(WAVES.length, st.wave) - 1];
  return def ?? WAVES[0];
}

export function waveProgress(st: SnakeRoyaleState) {
  return ((st.t * 1000) % WAVE_MS) / WAVE_MS;
}

export { TILE, WORLD_H, WORLD_W, GRID_W, GRID_H };
