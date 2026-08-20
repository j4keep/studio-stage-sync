/**
 * YAJ CITY RUN — a solo endless runner through the city.
 *
 * Completely different game to YAJ Obby: there is no course to finish and no
 * lava. You sprint forward automatically down a three-lane street, dodge
 * traffic, slide under signs, grab coins and pick up power-ups. The run ends
 * when you crash — the score is how far you got plus the coins you banked.
 */

export const LANES = [-2.7, 0, 2.7] as const;
export const LANE_SWITCH_SPEED = 12;
export const RUN_START_SPEED = 16.5;
export const RUN_MAX_SPEED = 34;
export const RUN_ACCEL = 0.46; // units of speed gained per second

export const JUMP_V = 11.5;
export const GRAVITY = 30;
export const SLIDE_MS = 620;
export const PLAYER_R = 0.55;

export type PowerKind = "magnet" | "shield" | "boost";
export type ObstacleKind = "car" | "bus" | "cone" | "barrier" | "sign";

export type Entity = {
  id: number;
  z: number;
  lane: 0 | 1 | 2;
  kind: ObstacleKind | "coin" | PowerKind;
  taken?: boolean;
};

export const POWER_META: Record<PowerKind, { label: string; ms: number; color: string; emoji: string }> = {
  magnet: { label: "Coin magnet", ms: 8000, color: "#ffd23f", emoji: "🧲" },
  shield: { label: "Shield", ms: 9000, color: "#37c8ff", emoji: "🛡️" },
  boost: { label: "Speed boost", ms: 5000, color: "#ff5ea8", emoji: "⚡" },
};

/** Obstacles you clear by jumping vs by sliding vs by changing lane. */
export function clearedBy(kind: ObstacleKind): "jump" | "slide" | "lane" {
  if (kind === "cone" || kind === "barrier") return "jump";
  if (kind === "sign") return "slide";
  return "lane";
}

export function obstacleSize(kind: ObstacleKind): [number, number, number] {
  switch (kind) {
    case "car":
      return [1.9, 1.3, 3.8];
    case "bus":
      return [2.2, 2.6, 6.4];
    case "cone":
      return [0.8, 0.9, 0.8];
    case "barrier":
      return [2.3, 1.0, 0.5];
    default:
      return [2.4, 0.7, 0.4]; // hanging sign
  }
}

export function obstacleColor(kind: ObstacleKind) {
  switch (kind) {
    case "car":
      return "#e6483c";
    case "bus":
      return "#f2b21c";
    case "cone":
      return "#ff7a1a";
    case "barrier":
      return "#e8e8ef";
    default:
      return "#3d3a55";
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RunEvent = "coin" | "power" | "hit" | "crash" | "jump" | "slide";

export type CityRunState = {
  z: number;
  lane: 0 | 1 | 2;
  x: number;
  y: number;
  vy: number;
  speed: number;
  sliding: number; // ms left
  coins: number;
  distance: number;
  over: boolean;
  powers: Record<PowerKind, number>; // ms left
  entities: Entity[];
};

export function initialRun(): CityRunState {
  return {
    z: 0,
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    speed: RUN_START_SPEED,
    sliding: 0,
    coins: 0,
    distance: 0,
    over: false,
    powers: { magnet: 0, shield: 0, boost: 0 },
    entities: [],
  };
}

export function scoreOf(s: CityRunState) {
  return Math.round(s.distance) + s.coins * 10;
}

/**
 * Endless world generator: keeps roughly 180m of street populated ahead of the
 * runner and drops everything that has fallen behind.
 */
export class CityRunWorld {
  private rnd: () => number;
  private nextId = 1;
  private builtTo = 26; // first stretch is deliberately empty so you get going

  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.rnd = mulberry32(seed);
  }

  ensure(state: CityRunState) {
    const target = state.z + 190;
    while (this.builtTo < target) {
      this.builtTo += 12 + this.rnd() * 8;
      const z = this.builtTo;
      const difficulty = Math.min(1, state.z / 1400);
      const roll = this.rnd();

      if (roll < 0.1 + difficulty * 0.06) {
        // Power-up floating in a lane
        const kinds: PowerKind[] = ["magnet", "shield", "boost"];
        state.entities.push({
          id: this.nextId++,
          z,
          lane: Math.floor(this.rnd() * 3) as 0 | 1 | 2,
          kind: kinds[Math.floor(this.rnd() * kinds.length)],
        });
        continue;
      }

      // A row of obstacles — never all three lanes, so there is always a way through.
      const blocked = this.rnd() < 0.25 + difficulty * 0.35 ? 2 : 1;
      const lanes: (0 | 1 | 2)[] = [0, 1, 2];
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(this.rnd() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
      }
      for (let b = 0; b < blocked; b++) {
        const kinds: ObstacleKind[] = ["car", "bus", "cone", "barrier", "sign"];
        const kind = kinds[Math.floor(this.rnd() * kinds.length)];
        state.entities.push({ id: this.nextId++, z: z + this.rnd() * 2, lane: lanes[b], kind });
      }

      // Coin trail in a free lane
      const freeLane = lanes[2];
      const coins = 3 + Math.floor(this.rnd() * 4);
      for (let c = 0; c < coins; c++) {
        state.entities.push({ id: this.nextId++, z: z + 2 + c * 1.7, lane: freeLane, kind: "coin" });
      }
    }

    state.entities = state.entities.filter((e) => e.z > state.z - 14 && !e.taken);
  }
}

type Input = { lane: 0 | 1 | 2; jump: boolean; slide: boolean };

/** One physics/collision step. Returns the events that happened this frame. */
export function step(s: CityRunState, input: Input, dtRaw: number): RunEvent[] {
  const events: RunEvent[] = [];
  if (s.over) return events;
  const dt = Math.min(dtRaw, 1 / 30);
  const ms = dt * 1000;

  (Object.keys(s.powers) as PowerKind[]).forEach((k) => {
    s.powers[k] = Math.max(0, s.powers[k] - ms);
  });

  s.speed = Math.min(RUN_MAX_SPEED, s.speed + RUN_ACCEL * dt);
  const speed = s.speed * (s.powers.boost > 0 ? 1.55 : 1);

  s.lane = input.lane;
  const targetX = LANES[s.lane];
  s.x += Math.max(-1, Math.min(1, (targetX - s.x) / 0.6)) * LANE_SWITCH_SPEED * dt;
  if (Math.abs(targetX - s.x) < 0.05) s.x = targetX;

  const grounded = s.y <= 0.001 && s.vy <= 0;
  if (input.jump && grounded) {
    s.vy = JUMP_V;
    s.sliding = 0;
    events.push("jump");
  }
  input.jump = false;
  if (input.slide && grounded && s.sliding <= 0) {
    s.sliding = SLIDE_MS;
    events.push("slide");
  }
  input.slide = false;
  s.sliding = Math.max(0, s.sliding - ms);

  s.vy -= GRAVITY * dt;
  s.y = Math.max(0, s.y + s.vy * dt);
  if (s.y === 0) s.vy = 0;

  s.z += speed * dt;
  s.distance = s.z;

  const airborne = s.y > 1.1;
  const low = s.sliding > 0;
  const magnetRange = s.powers.magnet > 0 ? 3.4 : 0;

  for (const e of s.entities) {
    if (e.taken) continue;
    const dz = e.z - s.z;
    if (dz > 2.4 || dz < -2.4) continue;

    if (e.kind === "coin" || e.kind === "magnet" || e.kind === "shield" || e.kind === "boost") {
      const sameLane = e.lane === s.lane;
      const pulled = e.kind === "coin" && Math.abs(LANES[e.lane] - s.x) <= magnetRange;
      if ((sameLane || pulled) && Math.abs(dz) < 1.6) {
        e.taken = true;
        if (e.kind === "coin") {
          s.coins += 1;
          events.push("coin");
        } else {
          s.powers[e.kind] = POWER_META[e.kind].ms;
          events.push("power");
        }
      }
      continue;
    }

    // Obstacle
    if (e.lane !== s.lane) continue;
    const [, h, d] = obstacleSize(e.kind);
    if (Math.abs(dz) > d / 2 + PLAYER_R) continue;
    const avoid = clearedBy(e.kind);
    if (avoid === "jump" && airborne && s.y > h * 0.75) continue;
    if (avoid === "slide" && low) continue;
    if (avoid === "lane" && airborne && s.y > h + 0.3) continue;

    e.taken = true;
    if (s.powers.shield > 0) {
      s.powers.shield = 0;
      s.speed = Math.max(RUN_START_SPEED, s.speed - 3);
      events.push("hit");
    } else {
      s.over = true;
      events.push("crash");
    }
    break;
  }

  return events;
}
