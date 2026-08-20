/**
 * YAJ TREASURE RUSH engine — pure state machine, no rendering.
 *
 * Responsibilities are grouped as small managers inside one deterministic step():
 * PlayerController, TreasureManager, KeyDoorSystem, TrapManager, TimerManager,
 * HealthManager and ScoreManager (score lives in ./score).
 */

import {
  BARREL_TRACKS,
  LEVEL,
  TILE,
  cellAt,
  isStaticSolid,
} from "./map";

export const ROUND_MS = 180_000;
export const MAX_HEARTS = 3;

export type PowerKind = "magnet" | "boost" | "shield";

export type ItemKind =
  | "coin"
  | "gem"
  | "chest"
  | "gold_chest"
  | "blue_key"
  | "gold_key"
  | "magnet"
  | "boost"
  | "shield";

export type Item = {
  id: string;
  kind: ItemKind;
  x: number;
  z: number;
  taken: boolean;
  /** Chests animate open before they hand over their treasure. */
  open?: boolean;
};

export type SwitchPad = { id: string; x: number; z: number; on: boolean };
export type Gate = { id: string; kind: "blue" | "switch"; col: number; row: number; x: number; z: number; open: boolean };
export type Spike = { id: string; x: number; z: number; offset: number; active: boolean };
export type Barrel = { id: string; x: number; z: number };

export type TrStatus = "playing" | "complete" | "failed" | "timeup";

export type TrEvent =
  | "coin"
  | "gem"
  | "chest"
  | "gold_chest"
  | "key"
  | "unlock"
  | "locked"
  | "switch"
  | "trap"
  | "heart"
  | "power"
  | "warn"
  | "complete"
  | "failed"
  | "timeup";

export type TrInput = {
  /** -1..1 screen-space stick axes. */
  ax: number;
  az: number;
  interact: boolean;
};

export type TrState = {
  t: number;
  timeLeft: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  moving: boolean;
  slippery: boolean;
  hearts: number;
  invuln: number;
  stumble: number;
  celebrate: number;
  interacting: number;
  coins: number;
  gems: number;
  chests: number;
  goldChests: number;
  keys: { blue: boolean; gold: boolean };
  powers: Record<PowerKind, number>;
  items: Item[];
  switches: SwitchPad[];
  gates: Gate[];
  spikes: Spike[];
  barrels: Barrel[];
  visited: Set<string>;
  warned: { thirty: boolean; ten: boolean };
  status: TrStatus;
};

const BASE_SPEED = 7.2;
const BOOST_SPEED = 10.8;
const RADIUS = 0.72;
const PICKUP = 1.15;
const REACH = 2.6;

const spot = (s: { x: number; z: number }) => ({ x: s.x, z: s.z });

export function initialTreasureRush(): TrState {
  const items: Item[] = [
    ...LEVEL.coins.map((c, i) => ({ id: `coin-${i}`, kind: "coin" as const, ...spot(c), taken: false })),
    ...LEVEL.gems.map((c, i) => ({ id: `gem-${i}`, kind: "gem" as const, ...spot(c), taken: false })),
    ...LEVEL.chests.map((c, i) => ({ id: `chest-${i}`, kind: "chest" as const, ...spot(c), taken: false, open: false })),
    ...LEVEL.goldChests.map((c, i) => ({ id: `gold-${i}`, kind: "gold_chest" as const, ...spot(c), taken: false, open: false })),
    ...LEVEL.blueKeys.map((c, i) => ({ id: `bkey-${i}`, kind: "blue_key" as const, ...spot(c), taken: false })),
    ...LEVEL.goldKeys.map((c, i) => ({ id: `gkey-${i}`, kind: "gold_key" as const, ...spot(c), taken: false })),
    ...LEVEL.magnets.map((c, i) => ({ id: `mag-${i}`, kind: "magnet" as const, ...spot(c), taken: false })),
    ...LEVEL.boosts.map((c, i) => ({ id: `boost-${i}`, kind: "boost" as const, ...spot(c), taken: false })),
    ...LEVEL.shields.map((c, i) => ({ id: `shield-${i}`, kind: "shield" as const, ...spot(c), taken: false })),
  ];

  return {
    t: 0,
    timeLeft: ROUND_MS,
    x: LEVEL.start.x,
    z: LEVEL.start.z,
    vx: 0,
    vz: 0,
    facing: Math.PI,
    moving: false,
    slippery: false,
    hearts: MAX_HEARTS,
    invuln: 0,
    stumble: 0,
    celebrate: 0,
    interacting: 0,
    coins: 0,
    gems: 0,
    chests: 0,
    goldChests: 0,
    keys: { blue: false, gold: false },
    powers: { magnet: 0, boost: 0, shield: 0 },
    items,
    switches: LEVEL.switches.map((c, i) => ({ id: `sw-${i}`, ...spot(c), on: false })),
    gates: [
      ...LEVEL.blueGates.map((c, i) => ({ id: `bg-${i}`, kind: "blue" as const, col: c.col, row: c.row, ...spot(c), open: false })),
      ...LEVEL.switchGates.map((c, i) => ({ id: `sg-${i}`, kind: "switch" as const, col: c.col, row: c.row, ...spot(c), open: false })),
    ],
    spikes: LEVEL.spikes.map((c, i) => ({ id: `spike-${i}`, ...spot(c), offset: (i * 700) % 2600, active: false })),
    barrels: BARREL_TRACKS.map((b, i) => ({ id: `barrel-${i}`, x: b.col * TILE, z: b.from * TILE })),
    visited: new Set<string>(),
    warned: { thirty: false, ten: false },
    status: "playing",
  };
}

/* ------------------------------------------------------------- collision */

function gateBlocks(s: TrState, col: number, row: number) {
  const g = s.gates.find((gg) => gg.col === col && gg.row === row);
  return Boolean(g && !g.open);
}

export function solidAt(s: TrState, col: number, row: number) {
  return isStaticSolid(col, row) || gateBlocks(s, col, row);
}

function blocked(s: TrState, x: number, z: number) {
  const col0 = Math.round(x / TILE);
  const row0 = Math.round(z / TILE);
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const col = col0 + dc;
      const row = row0 + dr;
      if (!solidAt(s, col, row)) continue;
      const cx = col * TILE;
      const cz = row * TILE;
      if (Math.abs(x - cx) < TILE / 2 + RADIUS && Math.abs(z - cz) < TILE / 2 + RADIUS) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------ interaction */

export type Prompt = { kind: "chest" | "gold_chest" | "switch" | "blue_gate" | "exit"; label: string; id?: string };

/** Whatever the player can act on right now — drives the INTERACT button label. */
export function promptFor(s: TrState): Prompt | null {
  const near = (x: number, z: number) => Math.hypot(s.x - x, s.z - z) <= REACH;

  const chest = s.items.find((i) => !i.taken && (i.kind === "chest" || i.kind === "gold_chest") && near(i.x, i.z));
  if (chest) {
    if (chest.kind === "gold_chest") return { kind: "gold_chest", label: s.keys.gold ? "Open gold chest" : "Gold key needed", id: chest.id };
    return { kind: "chest", label: "Open chest", id: chest.id };
  }

  const sw = s.switches.find((p) => !p.on && near(p.x, p.z));
  if (sw) return { kind: "switch", label: "Press switch", id: sw.id };

  const gate = s.gates.find((g) => g.kind === "blue" && !g.open && near(g.x, g.z));
  if (gate) return { kind: "blue_gate", label: s.keys.blue ? "Unlock blue gate" : "Blue key needed", id: gate.id };

  if (near(LEVEL.exit.x, LEVEL.exit.z)) return { kind: "exit", label: "Escape with treasure" };
  return null;
}

function doInteract(s: TrState, out: TrEvent[]) {
  const p = promptFor(s);
  if (!p) return;
  s.interacting = 420;

  if (p.kind === "chest" || p.kind === "gold_chest") {
    const item = s.items.find((i) => i.id === p.id);
    if (!item) return;
    if (item.kind === "gold_chest" && !s.keys.gold) {
      out.push("locked");
      return;
    }
    item.open = true;
    item.taken = true;
    if (item.kind === "gold_chest") {
      s.goldChests += 1;
      out.push("gold_chest");
    } else {
      s.chests += 1;
      out.push("chest");
    }
    return;
  }

  if (p.kind === "switch") {
    const sw = s.switches.find((w) => w.id === p.id);
    if (!sw) return;
    sw.on = true;
    out.push("switch");
    if (s.switches.every((w) => w.on)) {
      s.gates.filter((g) => g.kind === "switch").forEach((g) => (g.open = true));
      out.push("unlock");
    }
    return;
  }

  if (p.kind === "blue_gate") {
    if (!s.keys.blue) {
      out.push("locked");
      return;
    }
    const gate = s.gates.find((g) => g.id === p.id);
    if (gate) gate.open = true;
    out.push("unlock");
    return;
  }

  if (p.kind === "exit") finish(s, out);
}

function finish(s: TrState, out: TrEvent[]) {
  s.status = "complete";
  s.celebrate = 2600;
  out.push("complete");
}

/* -------------------------------------------------------------- managers */

function hurt(s: TrState, out: TrEvent[]) {
  if (s.invuln > 0) return;
  if (s.powers.shield > 0) {
    s.powers.shield = 0;
    s.invuln = 1200;
    s.stumble = 380;
    out.push("trap");
    return;
  }
  s.hearts -= 1;
  s.invuln = 1500;
  s.stumble = 720;
  out.push("trap");
  out.push("heart");
  if (s.hearts <= 0) {
    s.status = "failed";
    out.push("failed");
  }
}

function treasure(s: TrState, out: TrEvent[], dt: number) {
  const magnet = s.powers.magnet > 0;
  s.items.forEach((i) => {
    if (i.taken) return;
    const pullable = i.kind === "coin" || i.kind === "gem";
    const d = Math.hypot(s.x - i.x, s.z - i.z);
    if (magnet && pullable && d < 7) {
      const k = Math.min(1, dt * 6);
      i.x += (s.x - i.x) * k;
      i.z += (s.z - i.z) * k;
    }
    if (i.kind === "chest" || i.kind === "gold_chest") return;
    if (d > PICKUP) return;
    i.taken = true;
    switch (i.kind) {
      case "coin":
        s.coins += 1;
        out.push("coin");
        break;
      case "gem":
        s.gems += 1;
        out.push("gem");
        break;
      case "blue_key":
        s.keys.blue = true;
        out.push("key");
        break;
      case "gold_key":
        s.keys.gold = true;
        out.push("key");
        break;
      case "magnet":
        s.powers.magnet = 9000;
        out.push("power");
        break;
      case "boost":
        s.powers.boost = 7000;
        out.push("power");
        break;
      case "shield":
        s.powers.shield = 20000;
        out.push("power");
        break;
    }
  });
}

function traps(s: TrState, out: TrEvent[], dtMs: number) {
  s.spikes.forEach((sp) => {
    sp.active = ((s.t + sp.offset) % 2600) < 950;
    if (sp.active && Math.hypot(s.x - sp.x, s.z - sp.z) < 1.15) hurt(s, out);
  });

  BARREL_TRACKS.forEach((track, i) => {
    const b = s.barrels[i];
    if (!b) return;
    const span = (track.to - track.from) * TILE;
    const cycle = (span * 2) / track.speed;
    const p = ((s.t / 1000) * (1 / cycle) + track.phase) % 1;
    const travel = p < 0.5 ? p * 2 : (1 - p) * 2;
    b.x = track.col * TILE;
    b.z = track.from * TILE + travel * span;
    if (Math.hypot(s.x - b.x, s.z - b.z) < 1.15) hurt(s, out);
  });

  const cell = cellAt(Math.round(s.x / TILE), Math.round(s.z / TILE));
  s.slippery = cell === "~";
  void dtMs;
}

/* ------------------------------------------------------------------ step */

export function step(s: TrState, input: TrInput, dtSec: number): TrEvent[] {
  const out: TrEvent[] = [];
  if (s.status !== "playing") return out;

  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  const dtMs = dt * 1000;
  s.t += dtMs;

  // TimerManager
  s.timeLeft = Math.max(0, s.timeLeft - dtMs);
  if (s.timeLeft <= 30_000 && !s.warned.thirty) {
    s.warned.thirty = true;
    out.push("warn");
  }
  if (s.timeLeft <= 10_000 && !s.warned.ten) {
    s.warned.ten = true;
    out.push("warn");
  }
  if (s.timeLeft <= 0) {
    s.status = "timeup";
    out.push("timeup");
    return out;
  }

  (Object.keys(s.powers) as PowerKind[]).forEach((k) => {
    if (s.powers[k] > 0) s.powers[k] = Math.max(0, s.powers[k] - dtMs);
  });
  s.invuln = Math.max(0, s.invuln - dtMs);
  s.stumble = Math.max(0, s.stumble - dtMs);
  s.interacting = Math.max(0, s.interacting - dtMs);

  // PlayerController
  const mag = Math.hypot(input.ax, input.az);
  const stumbling = s.stumble > 0;
  const top = (s.powers.boost > 0 ? BOOST_SPEED : BASE_SPEED) * (stumbling ? 0.28 : 1);
  const nx = mag > 1 ? input.ax / mag : input.ax;
  const nz = mag > 1 ? input.az / mag : input.az;
  const grip = s.slippery ? 3.2 : 14;
  s.vx += (nx * top - s.vx) * Math.min(1, dt * grip);
  s.vz += (nz * top - s.vz) * Math.min(1, dt * grip);

  const stepX = s.vx * dt;
  const stepZ = s.vz * dt;
  if (!blocked(s, s.x + stepX, s.z)) s.x += stepX;
  else s.vx = 0;
  if (!blocked(s, s.x, s.z + stepZ)) s.z += stepZ;
  else s.vz = 0;

  const speed = Math.hypot(s.vx, s.vz);
  s.moving = speed > 0.6;
  if (s.moving) s.facing = Math.atan2(s.vx, s.vz);

  s.visited.add(`${Math.round(s.x / TILE)},${Math.round(s.z / TILE)}`);

  treasure(s, out, dt);
  traps(s, out, dtMs);
  if (s.status !== "playing") return out;

  if (input.interact) doInteract(s, out);

  // Walking onto the exit finishes the run too, so escaping never feels fiddly.
  if (Math.hypot(s.x - LEVEL.exit.x, s.z - LEVEL.exit.z) < 1.3) finish(s, out);

  return out;
}
