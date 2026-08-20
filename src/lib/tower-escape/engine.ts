/**
 * YAJ Tower Escape — PlayerController + PlatformSystem + ObstacleManager +
 * CheckpointManager + HealthManager + TimerManager + Collectible/PowerUp managers.
 *
 * Deterministic: same level layout + same inputs => same run, which is what the
 * future asynchronous challenge mode needs (both players climb the same tower).
 */

import {
  Checkpoint,
  Hazard,
  Platform,
  PowerKind,
  TowerLevel,
  buildTower,
} from "./level";

export const MAX_HEARTS = 3;
export const RUN_MS = 5 * 60 * 1000;

export const PLAYER_W = 30;
export const PLAYER_H = 46;

const GRAVITY = 2450;
const MOVE_SPEED = 268;
const AIR_ACCEL = 1500;
const GROUND_ACCEL = 2600;
const FRICTION = 2400;
const JUMP_VY = 1010;
const MAX_FALL = -1250;
const CLIMB_SPEED = 165;
const COYOTE = 0.09;
const BUFFER = 0.11;
const HURT_INVULN = 1.15;
const FALL_MARGIN = 620;

export type AnimState = "idle" | "run" | "jump" | "fall" | "land" | "climb" | "hang" | "stumble" | "celebrate";

export type TowerInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  up: boolean;
  down: boolean;
};

export const NO_INPUT: TowerInput = { left: false, right: false, jump: false, up: false, down: false };

export type RectBox = { x: number; y: number; w: number; h: number };

export type TowerStatus = "climbing" | "escaped" | "failed";

export type TowerState = {
  level: TowerLevel;
  status: TowerStatus;
  t: number; // seconds elapsed in the run (physics clock)
  timeLeft: number; // ms
  hearts: number;
  stars: number;
  bonusStars: number;
  score: number;
  checkpoint: number; // index reached (0 = spawn)
  checkpointPos: { x: number; y: number };
  highest: number; // best world y reached
  falls: number;
  // player
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  climbing: boolean;
  jumps: number;
  coyote: number;
  buffer: number;
  invuln: number;
  stumble: number;
  landed: number;
  anim: AnimState;
  // world bookkeeping
  taken: Record<string, boolean>;
  collapsing: Record<string, number>; // fall platform -> seconds until it drops
  gone: Record<string, number>; // fall platform -> seconds until rebuild
  powers: Record<PowerKind, number>; // remaining seconds
  events: TowerEvent[];
  checkpointFlash: number;
  cpJustHit: number | null;
};

export type TowerEvent =
  | "jump"
  | "land"
  | "star"
  | "bonusStar"
  | "power"
  | "hit"
  | "fall"
  | "checkpoint"
  | "collapse"
  | "warn"
  | "finish"
  | "failed";

export function initialTower(): TowerState {
  const level = buildTower();
  return {
    level,
    status: "climbing",
    t: 0,
    timeLeft: RUN_MS,
    hearts: MAX_HEARTS,
    stars: 0,
    bonusStars: 0,
    score: 0,
    checkpoint: 0,
    checkpointPos: { ...level.spawn },
    highest: level.spawn.y,
    falls: 0,
    x: level.spawn.x,
    y: level.spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    climbing: false,
    jumps: 0,
    coyote: 0,
    buffer: 0,
    invuln: 0,
    stumble: 0,
    landed: 0,
    anim: "idle",
    taken: {},
    collapsing: {},
    gone: {},
    powers: { shield: 0, double: 0, speed: 0 },
    events: [],
    checkpointFlash: 0,
    cpJustHit: null,
  };
}

/* ── PlatformSystem: world-space motion ─────────────────────────────────────── */

export function platformBox(p: Platform, t: number): RectBox {
  let x = p.x;
  let y = p.y;
  if ((p.kind === "mover" || p.kind === "elevator") && p.amp && p.speed) {
    const o = Math.sin((t * p.speed + (p.phase ?? 0)) * Math.PI * 2) * p.amp;
    if (p.axis === "y") y += o;
    else x += o;
  }
  return { x, y, w: p.w, h: p.h };
}

/** Blink platforms are solid only while "on". */
export function platformSolid(p: Platform, t: number, st: TowerState): boolean {
  if (p.kind === "blink") {
    const on = p.on ?? 1.5;
    const off = p.off ?? 1.2;
    const cycle = on + off;
    const at = (t * 1 + (p.phase ?? 0) * cycle) % cycle;
    return at < on;
  }
  if (p.kind === "fall") return !st.gone[p.id];
  return true;
}

export function hazardBox(h: Hazard, t: number): RectBox {
  let x = h.x;
  let y = h.y;
  if (h.amp && h.speed) {
    const o = Math.sin((t * h.speed + (h.phase ?? 0)) * Math.PI * 2) * h.amp;
    if (h.axis === "y") y += o;
    else x += o;
  }
  if (h.kind === "bar") {
    const a = t * (h.rate ?? 0.5) * Math.PI * 2;
    const len = h.len ?? 120;
    x = h.x + Math.cos(a) * len;
    y = h.y + Math.sin(a) * len * 0.55;
  }
  return { x, y, w: h.w, h: h.h };
}

export function hazardActive(h: Hazard, t: number): boolean {
  if (h.kind !== "laser") return true;
  const on = h.on ?? 1.2;
  const off = h.off ?? 1.2;
  const cycle = on + off;
  const at = (t + (h.phase ?? 0) * cycle) % cycle;
  return at < on;
}

const overlap = (a: RectBox, b: RectBox) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const playerBox = (st: TowerState): RectBox => ({ x: st.x, y: st.y, w: PLAYER_W, h: PLAYER_H });

function sectionFloor(st: TowerState) {
  return st.checkpointPos.y - FALL_MARGIN;
}

/* ── Simulation ─────────────────────────────────────────────────────────────── */

const STEP = 1 / 120;

export function step(state: TowerState, input: TowerInput, dtMs: number): TowerState {
  if (state.status !== "climbing") return state;
  const st: TowerState = { ...state, events: [] };
  let left = Math.min(dtMs, 120);
  while (left > 0) {
    const dt = Math.min(STEP, left / 1000);
    tick(st, input, dt);
    left -= dt * 1000;
    if (st.status !== "climbing") break;
  }
  return st;
}

function tick(st: TowerState, input: TowerInput, dt: number) {
  st.t += dt;
  const prevLeft = st.timeLeft;
  st.timeLeft = Math.max(0, st.timeLeft - dt * 1000);
  if (prevLeft > 30_000 && st.timeLeft <= 30_000) st.events.push("warn");

  for (const k of Object.keys(st.powers) as PowerKind[]) {
    if (st.powers[k] > 0) st.powers[k] = Math.max(0, st.powers[k] - dt);
  }
  if (st.invuln > 0) st.invuln = Math.max(0, st.invuln - dt);
  if (st.stumble > 0) st.stumble = Math.max(0, st.stumble - dt);
  if (st.landed > 0) st.landed = Math.max(0, st.landed - dt);
  if (st.checkpointFlash > 0) st.checkpointFlash = Math.max(0, st.checkpointFlash - dt);

  // Collapsing floor timers
  for (const id of Object.keys(st.collapsing)) {
    st.collapsing[id] -= dt;
    if (st.collapsing[id] <= 0) {
      delete st.collapsing[id];
      st.gone[id] = 2.6;
      st.events.push("collapse");
    }
  }
  for (const id of Object.keys(st.gone)) {
    st.gone[id] -= dt;
    if (st.gone[id] <= 0) delete st.gone[id];
  }

  if (st.timeLeft <= 0) {
    fail(st);
    return;
  }

  const climbZone = st.level.climbs.find((c) => overlap(playerBox(st), c));
  const wantClimb = Boolean(climbZone) && (input.up || input.down || st.climbing);
  const speedMul = st.powers.speed > 0 ? 1.34 : 1;

  if (wantClimb && climbZone) {
    st.climbing = true;
    st.vy = input.up ? CLIMB_SPEED : input.down ? -CLIMB_SPEED : 0;
    st.vx = 0;
    st.x += (input.right ? 1 : input.left ? -1 : 0) * 60 * dt;
    st.y += st.vy * dt;
    if (st.y > climbZone.y + climbZone.h - PLAYER_H * 0.4) {
      // Top out of the ladder onto the deck above.
      st.climbing = false;
      st.vy = 240;
    }
    if (input.jump && !st.buffer) {
      st.climbing = false;
      st.vy = JUMP_VY * 0.85;
      st.events.push("jump");
    }
    st.anim = input.up || input.down ? "climb" : "hang";
    collectibles(st);
    obstacles(st);
    checkpoints(st);
    finish(st);
    return;
  }
  st.climbing = false;

  // Horizontal movement
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = dir * MOVE_SPEED * speedMul;
  const accel = st.onGround ? GROUND_ACCEL : AIR_ACCEL;
  if (st.stumble > 0) {
    st.vx -= Math.sign(st.vx) * FRICTION * 0.6 * dt;
  } else if (dir !== 0) {
    st.facing = dir > 0 ? 1 : -1;
    if (st.vx < target) st.vx = Math.min(target, st.vx + accel * dt);
    else st.vx = Math.max(target, st.vx - accel * dt);
  } else {
    const f = FRICTION * (st.onGround ? 1 : 0.35) * dt;
    st.vx = Math.abs(st.vx) <= f ? 0 : st.vx - Math.sign(st.vx) * f;
  }

  // Jump (with coyote time + input buffering so landings feel reliable)
  st.buffer = input.jump ? Math.max(st.buffer, BUFFER) : 0;
  st.coyote = st.onGround ? COYOTE : Math.max(0, st.coyote - dt);
  const maxJumps = st.powers.double > 0 ? 2 : 1;
  if (st.buffer > 0 && st.stumble <= 0) {
    if (st.coyote > 0 || st.jumps < maxJumps) {
      if (st.coyote > 0) st.jumps = 1;
      else st.jumps += 1;
      st.vy = JUMP_VY;
      st.onGround = false;
      st.coyote = 0;
      st.buffer = 0;
      st.events.push("jump");
    }
  }
  if (st.buffer > 0) st.buffer = Math.max(0, st.buffer - dt);

  st.vy = Math.max(MAX_FALL, st.vy - GRAVITY * dt);

  // ── Vertical resolve (platforms move in world space and carry the player) ──
  const wasOn = st.onGround;
  st.onGround = false;
  const prevBottom = st.y;
  st.y += st.vy * dt;

  let carryX = 0;
  let conveyor = 0;
  let standing: Platform | null = null;

  for (const p of st.level.platforms) {
    if (!platformSolid(p, st.t, st)) continue;
    const box = platformBox(p, st.t);
    const me = playerBox(st);
    if (!overlap(me, box)) continue;
    const top = box.y + box.h;
    if (st.vy <= 0 && prevBottom + 1 >= top - 14) {
      // Landing on top
      st.y = top;
      if (p.kind === "bounce") {
        st.vy = JUMP_VY * (p.power ?? 1.4);
        st.jumps = 0;
        st.events.push("jump");
      } else {
        st.vy = 0;
        st.onGround = true;
        st.jumps = 0;
        standing = p;
        if (!wasOn) {
          st.landed = 0.18;
          st.anim = "land";
          st.events.push("land");
        }
        if (p.kind === "mover" || p.kind === "elevator") {
          const nextBox = platformBox(p, st.t + STEP);
          carryX = nextBox.x - box.x;
          st.y += nextBox.y - box.y;
        }
        if (p.kind === "conveyor") conveyor = (p.dir ?? 1) * 165;
        if (p.kind === "fall" && !st.collapsing[p.id] && !st.gone[p.id]) st.collapsing[p.id] = 0.55;
      }
    } else if (st.vy > 0 && prevBottom + PLAYER_H <= box.y + 6) {
      // Bumped head
      st.y = box.y - PLAYER_H;
      st.vy = 0;
    }
  }

  // ── Horizontal resolve ────────────────────────────────────────────────────
  st.x += st.vx * dt + carryX + conveyor * dt;
  for (const p of st.level.platforms) {
    if (!platformSolid(p, st.t, st)) continue;
    if (standing && p.id === standing.id) continue;
    const box = platformBox(p, st.t);
    const me = playerBox(st);
    if (!overlap(me, box)) continue;
    const fromTop = box.y + box.h - me.y;
    if (fromTop > 0 && fromTop < 16 && st.vy <= 0) {
      st.y = box.y + box.h;
      st.vy = 0;
      st.onGround = true;
      continue;
    }
    const overlapLeft = me.x + me.w - box.x;
    const overlapRight = box.x + box.w - me.x;
    if (overlapLeft < overlapRight) st.x = box.x - PLAYER_W;
    else st.x = box.x + box.w;
    st.vx = 0;
  }

  st.x = Math.max(8, Math.min(st.level.width - 8 - PLAYER_W, st.x));
  st.highest = Math.max(st.highest, st.y);

  // Animation state
  if (st.stumble > 0) st.anim = "stumble";
  else if (st.landed > 0) st.anim = "land";
  else if (!st.onGround) st.anim = st.vy > 40 ? "jump" : "fall";
  else if (Math.abs(st.vx) > 26) st.anim = "run";
  else st.anim = "idle";

  collectibles(st);
  obstacles(st);
  checkpoints(st);

  // Fell out of the section
  if (st.y < sectionFloor(st)) {
    st.falls += 1;
    st.events.push("fall");
    damage(st, true);
    return;
  }

  finish(st);
}

function collectibles(st: TowerState) {
  const me = playerBox(st);
  const reach = 26;
  for (const s of st.level.stars) {
    if (st.taken[s.id]) continue;
    if (Math.abs(s.x - (me.x + me.w / 2)) < reach && Math.abs(s.y - (me.y + me.h / 2)) < reach + 6) {
      st.taken[s.id] = true;
      st.stars += 1;
      if (s.bonus) st.bonusStars += 1;
      st.score += s.bonus ? 220 : 120;
      st.events.push(s.bonus ? "bonusStar" : "star");
    }
  }
  for (const u of st.level.powerups) {
    if (st.taken[u.id]) continue;
    if (Math.abs(u.x - (me.x + me.w / 2)) < 30 && Math.abs(u.y - (me.y + me.h / 2)) < 34) {
      st.taken[u.id] = true;
      st.powers[u.kind] = u.kind === "shield" ? 999 : 12;
      st.score += 80;
      st.events.push("power");
    }
  }
}

function obstacles(st: TowerState) {
  if (st.invuln > 0) return;
  const me = playerBox(st);
  for (const h of st.level.hazards) {
    if (!hazardActive(h, st.t)) continue;
    const box = hazardBox(h, st.t);
    const b = h.kind === "bar" ? { x: box.x - 14, y: box.y - 14, w: 28, h: 28 } : box;
    if (overlap(me, b)) {
      damage(st, false);
      return;
    }
  }
}

function checkpoints(st: TowerState) {
  const me = playerBox(st);
  for (const c of st.level.checkpoints as Checkpoint[]) {
    if (c.index <= st.checkpoint) continue;
    if (Math.abs(c.x - (me.x + me.w / 2)) < 70 && Math.abs(c.y - me.y) < 70) {
      st.checkpoint = c.index;
      st.checkpointPos = { x: c.x, y: c.y + 4 };
      st.score += 250;
      st.checkpointFlash = 1.2;
      st.cpJustHit = c.index;
      st.events.push("checkpoint");
    }
  }
}

function finish(st: TowerState) {
  const f = st.level.finish;
  if (overlap(playerBox(st), f)) {
    st.status = "escaped";
    st.anim = "celebrate";
    st.events.push("finish");
  }
}

function damage(st: TowerState, fell: boolean) {
  if (st.powers.shield > 0 && !fell) {
    st.powers.shield = 0;
    st.invuln = HURT_INVULN;
    st.stumble = 0.3;
    st.events.push("hit");
    return;
  }
  st.hearts -= 1;
  st.invuln = HURT_INVULN;
  st.stumble = 0.45;
  if (!fell) st.events.push("hit");
  if (st.hearts <= 0) {
    fail(st);
    return;
  }
  respawn(st);
}

export function respawn(st: TowerState) {
  st.x = st.checkpointPos.x;
  st.y = st.checkpointPos.y;
  st.vx = 0;
  st.vy = 0;
  st.onGround = true;
  st.climbing = false;
  st.jumps = 0;
  st.anim = "idle";
  st.collapsing = {};
  st.gone = {};
}

function fail(st: TowerState) {
  st.status = "failed";
  st.hearts = Math.max(0, st.hearts);
  st.events.push("failed");
}

/** Retry from the last checkpoint with a fresh heart bar and a small time penalty. */
export function retryFromCheckpoint(st: TowerState): TowerState {
  const next: TowerState = {
    ...st,
    status: "climbing",
    hearts: MAX_HEARTS,
    timeLeft: Math.max(30_000, st.timeLeft > 0 ? st.timeLeft : 60_000),
    events: [],
    invuln: HURT_INVULN,
    powers: { ...st.powers },
  };
  respawn(next);
  return next;
}

export function currentSection(st: TowerState) {
  return st.level.sections.find((s) => st.y >= s.from && st.y < s.to) ?? st.level.sections[0];
}
