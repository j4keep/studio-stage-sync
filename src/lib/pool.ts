/**
 * 8-ball pool: table geometry, ball physics simulation and rules engine.
 *
 * The simulation is a pure function of (balls, angle, power), so both the
 * shooter and the opponent can independently reproduce the exact same
 * animation frames from the same inputs — only the resting result needs to
 * travel over the network.
 */

export type BallId = number; // 0 cue, 1-7 solids, 8 eight, 9-15 stripes
export type Group = "solids" | "stripes";
export type Seat = 0 | 1;

export type Ball = {
  id: BallId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  potted: boolean;
};

export type PoolPhase = "break" | "playing" | "over";

export type PoolState = {
  balls: Ball[];
  groups: [Group | null, Group | null];
  phase: PoolPhase;
  /** Which seat is logically on the table right now — independent of whose turn the DB row reflects,
   *  since in solo mode the computer's animated turn never becomes the DB's "current turn". */
  turnSeat: Seat;
  ballInHand: boolean;
  winnerSeat: Seat | null;
  lastShot: { angle: number; power: number; seat: Seat; moveNumber: number } | null;
  preShotBalls: Ball[] | null;
  lastMessage: string | null;
};

// ---- Table geometry (world units) ----
export const TABLE_W = 1000;
export const TABLE_H = 500;
export const BALL_R = 14;
export const POCKET_R_CORNER = 32;
export const POCKET_R_SIDE = 27;

export const POCKETS: { x: number; y: number; r: number }[] = [
  { x: 0, y: 0, r: POCKET_R_CORNER },
  { x: TABLE_W / 2, y: 0, r: POCKET_R_SIDE },
  { x: TABLE_W, y: 0, r: POCKET_R_CORNER },
  { x: 0, y: TABLE_H, r: POCKET_R_CORNER },
  { x: TABLE_W / 2, y: TABLE_H, r: POCKET_R_SIDE },
  { x: TABLE_W, y: TABLE_H, r: POCKET_R_CORNER },
];

export const BALL_COLORS: Record<number, string> = {
  1: "#e9c336",
  2: "#1f5fd6",
  3: "#d92b2b",
  4: "#7b3fbf",
  5: "#e8791c",
  6: "#1f9251",
  7: "#8a2331",
  8: "#161616",
  9: "#e9c336",
  10: "#1f5fd6",
  11: "#d92b2b",
  12: "#7b3fbf",
  13: "#e8791c",
  14: "#1f9251",
  15: "#8a2331",
};

export function isStripe(id: BallId): boolean {
  return id >= 9 && id <= 15;
}

export function ballGroup(id: BallId): Group | null {
  if (id >= 1 && id <= 7) return "solids";
  if (id >= 9 && id <= 15) return "stripes";
  return null;
}

export function groupBallIds(group: Group): number[] {
  return group === "solids" ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
}

export function groupClearedInBalls(group: Group, balls: Ball[]): boolean {
  return groupBallIds(group).every((id) => balls.find((b) => b.id === id)?.potted);
}

export function ballsRemaining(group: Group | null, balls: Ball[]): number {
  if (!group) return 7;
  return groupBallIds(group).filter((id) => !balls.find((b) => b.id === id)?.potted).length;
}

// ---- Rack ----
const RACK_ORDER: number[][] = [[1], [9, 2], [10, 8, 3], [4, 11, 5, 12], [6, 13, 14, 7, 15]];

export function initialPool(): PoolState {
  const footX = TABLE_W * 0.75;
  const footY = TABLE_H / 2;
  const dx = BALL_R * Math.sqrt(3);
  const dy = BALL_R * 2;
  const balls: Ball[] = [];
  RACK_ORDER.forEach((row, r) => {
    const x = footX + r * dx;
    const n = row.length;
    row.forEach((id, k) => {
      const y = footY + (k - (n - 1) / 2) * dy;
      balls.push({ id, x, y, vx: 0, vy: 0, potted: false });
    });
  });
  balls.push({ id: 0, x: TABLE_W * 0.25, y: TABLE_H / 2, vx: 0, vy: 0, potted: false });
  balls.sort((a, b) => a.id - b.id);
  return {
    balls,
    groups: [null, null],
    phase: "break",
    turnSeat: 0,
    ballInHand: false,
    winnerSeat: null,
    lastShot: null,
    preShotBalls: null,
    lastMessage: null,
  };
}

// ---- Physics ----
const FRICTION = 0.99;
const MIN_SPEED = 0.015;
const MAX_STEPS = 1400;
const RESTITUTION = 0.92;
export const MIN_SHOT_SPEED = 3;
export const MAX_SHOT_SPEED = 11;

export type ShotSimResult = {
  frames: Ball[][];
  finalBalls: Ball[];
  potted: BallId[];
  firstContact: BallId | null;
  railContactAfterContact: boolean;
  /** Frame indices where sound-worthy physics events happened, for animation playback. */
  strikeFrame: number;
  hitFrames: number[];
  railFrames: number[];
  pocketFrames: number[];
};

function cloneBalls(balls: Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export function simulateShot(inputBalls: Ball[], angle: number, power: number): ShotSimResult {
  const balls = cloneBalls(inputBalls);
  const cue = balls.find((b) => b.id === 0);
  const speed = MIN_SHOT_SPEED + Math.max(0, Math.min(1, power)) * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);
  if (cue) {
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;
  }

  const wasPotted = new Set(balls.filter((b) => b.potted).map((b) => b.id));
  const frames: Ball[][] = [cloneBalls(balls)];
  let firstContact: BallId | null = null;
  let contactMade = false;
  let railContactAfterContact = false;
  const hitFrames: number[] = [];
  const railFrames: number[] = [];
  const pocketFrames: number[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    for (const b of balls) {
      if (b.potted) continue;
      b.x += b.vx;
      b.y += b.vy;
    }

    let pocketedThisStep = false;
    for (const b of balls) {
      if (b.potted) continue;
      for (const p of POCKETS) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy < p.r * p.r) {
          b.potted = true;
          b.vx = 0;
          b.vy = 0;
          pocketedThisStep = true;
          break;
        }
      }
    }

    let railHitThisStep = false;
    for (const b of balls) {
      if (b.potted) continue;
      let bounced = false;
      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx = -b.vx * RESTITUTION;
        bounced = true;
      } else if (b.x > TABLE_W - BALL_R) {
        b.x = TABLE_W - BALL_R;
        b.vx = -b.vx * RESTITUTION;
        bounced = true;
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        b.vy = -b.vy * RESTITUTION;
        bounced = true;
      } else if (b.y > TABLE_H - BALL_R) {
        b.y = TABLE_H - BALL_R;
        b.vy = -b.vy * RESTITUTION;
        bounced = true;
      }
      if (bounced) {
        railHitThisStep = true;
        if (contactMade) railContactAfterContact = true;
      }
    }

    let ballHitThisStep = false;
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.potted) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.potted) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = BALL_R * 2;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            a.vx += velAlongNormal * nx;
            a.vy += velAlongNormal * ny;
            b.vx -= velAlongNormal * nx;
            b.vy -= velAlongNormal * ny;

            if (a.id === 0 && firstContact === null) firstContact = b.id;
            if (b.id === 0 && firstContact === null) firstContact = a.id;
            contactMade = true;
            ballHitThisStep = true;
          }
        }
      }
    }

    for (const b of balls) {
      if (b.potted) continue;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (Math.hypot(b.vx, b.vy) < MIN_SPEED) {
        b.vx = 0;
        b.vy = 0;
      }
    }

    frames.push(cloneBalls(balls));
    const idx = frames.length - 1;
    if (ballHitThisStep) hitFrames.push(idx);
    if (railHitThisStep) railFrames.push(idx);
    if (pocketedThisStep) pocketFrames.push(idx);

    if (balls.every((b) => b.potted || (b.vx === 0 && b.vy === 0))) break;
  }

  const potted = balls.filter((b) => b.potted && !wasPotted.has(b.id)).map((b) => b.id);

  return {
    frames,
    finalBalls: balls,
    potted,
    firstContact,
    railContactAfterContact,
    strikeFrame: 0,
    hitFrames,
    railFrames,
    pocketFrames,
  };
}

// ---- Rules engine ----
export type ShotResolution = {
  nextState: PoolState;
  turnContinues: boolean;
  winnerSeat: Seat | null;
  foul: boolean;
  message: string;
};

export function resolveShot(
  state: PoolState,
  shooterSeat: Seat,
  angle: number,
  power: number,
  sim: ShotSimResult,
  moveNumber: number,
): ShotResolution {
  const oppSeat: Seat = shooterSeat === 0 ? 1 : 0;
  const myGroupBefore = state.groups[shooterSeat];
  const pottedNonCue = sim.potted.filter((id) => id !== 0);
  const cueScratched = sim.potted.includes(0);
  const eightPotted = pottedNonCue.includes(8);
  const myGroupClearedBefore = myGroupBefore ? groupClearedInBalls(myGroupBefore, state.balls) : false;

  let winnerSeat: Seat | null = null;
  let foul = false;
  let message: string;
  let groups: [Group | null, Group | null] = [...state.groups] as [Group | null, Group | null];
  let turnContinues = false;

  if (eightPotted) {
    const legalEight =
      myGroupBefore !== null && myGroupClearedBefore && sim.firstContact === 8 && !cueScratched;
    if (legalEight) {
      winnerSeat = shooterSeat;
      message = "Eight ball, legally pocketed — game over!";
    } else {
      winnerSeat = oppSeat;
      foul = true;
      message = cueScratched
        ? "Scratched while pocketing the 8-ball — loss."
        : myGroupBefore === null
          ? "Pocketed the 8-ball on an open table — loss."
          : !myGroupClearedBefore
            ? "Pocketed the 8-ball early — loss."
            : "Illegal 8-ball shot — loss.";
    }
  } else {
    const noContact = sim.firstContact === null;
    let wrongFirst = false;
    if (!noContact && myGroupBefore !== null) {
      wrongFirst = myGroupClearedBefore
        ? sim.firstContact !== 8
        : ballGroup(sim.firstContact as number) !== myGroupBefore;
    } else if (!noContact && myGroupBefore === null) {
      wrongFirst = sim.firstContact === 8;
    }
    const noRail = !noContact && pottedNonCue.length === 0 && !sim.railContactAfterContact;

    foul = noContact || wrongFirst || cueScratched || noRail;

    if (!foul && myGroupBefore === null && pottedNonCue.length > 0) {
      const firstGroupBall = [...pottedNonCue].sort((a, b) => a - b)[0];
      const g = ballGroup(firstGroupBall) as Group;
      const other: Group = g === "solids" ? "stripes" : "solids";
      groups = shooterSeat === 0 ? [g, other] : [other, g];
    }

    const myGroupAfter = groups[shooterSeat];
    turnContinues = !foul && pottedNonCue.some((id) => ballGroup(id) === myGroupAfter);

    if (foul) {
      message = cueScratched
        ? "Scratch — opponent gets ball in hand."
        : noContact
          ? "No ball contacted — foul, ball in hand."
          : wrongFirst
            ? "Wrong ball hit first — foul, ball in hand."
            : "No rail after contact — foul, ball in hand.";
    } else if (pottedNonCue.length > 0) {
      message = turnContinues ? "Nice shot — shoot again." : "Potted the opponent's ball — turn passes.";
    } else {
      message = "No ball potted — turn passes.";
    }
  }

  const balls = sim.finalBalls.map((b) => ({ ...b }));
  if (cueScratched) {
    const cue = balls.find((b) => b.id === 0);
    if (cue) {
      cue.potted = true;
      cue.vx = 0;
      cue.vy = 0;
    }
  }

  const nextState: PoolState = {
    balls,
    groups,
    phase: winnerSeat !== null ? "over" : "playing",
    turnSeat: turnContinues ? shooterSeat : oppSeat,
    ballInHand: winnerSeat === null && foul,
    winnerSeat,
    lastShot: { angle, power, seat: shooterSeat, moveNumber },
    preShotBalls: cloneBalls(state.balls),
    lastMessage: message,
  };

  return { nextState, turnContinues, winnerSeat, foul, message };
}

export function canPlaceCueBall(balls: Ball[], x: number, y: number): boolean {
  if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) return false;
  return balls.every((b) => b.id === 0 || b.potted || Math.hypot(b.x - x, b.y - y) >= BALL_R * 2 - 1);
}

export function placeCueBall(state: PoolState, x: number, y: number): PoolState {
  const balls = cloneBalls(state.balls);
  const cue = balls.find((b) => b.id === 0);
  if (cue) {
    cue.x = x;
    cue.y = y;
    cue.vx = 0;
    cue.vy = 0;
    cue.potted = false;
  }
  return { ...state, balls, ballInHand: false };
}

// ---- Simple computer opponent ----
export function computerShot(state: PoolState, seat: Seat): { angle: number; power: number } {
  const cue = state.balls.find((b) => b.id === 0);
  if (!cue) return { angle: Math.random() * Math.PI * 2, power: 0.5 };

  const myGroup = state.groups[seat];
  const cleared = myGroup ? groupClearedInBalls(myGroup, state.balls) : false;

  let targets: Ball[];
  if (myGroup && !cleared) {
    targets = state.balls.filter((b) => !b.potted && ballGroup(b.id) === myGroup);
  } else if (myGroup && cleared) {
    targets = state.balls.filter((b) => !b.potted && b.id === 8);
  } else {
    targets = state.balls.filter((b) => !b.potted && b.id !== 0 && b.id !== 8);
  }
  if (!targets.length) targets = state.balls.filter((b) => !b.potted && b.id !== 0);

  let best: { angle: number; power: number; score: number } | null = null;
  for (const target of targets) {
    for (const pocket of POCKETS) {
      const toPocket = { x: pocket.x - target.x, y: pocket.y - target.y };
      const distPocket = Math.hypot(toPocket.x, toPocket.y);
      if (distPocket < 1) continue;
      const dir = { x: toPocket.x / distPocket, y: toPocket.y / distPocket };
      const ghost = { x: target.x - dir.x * BALL_R * 2, y: target.y - dir.y * BALL_R * 2 };
      const toGhost = { x: ghost.x - cue.x, y: ghost.y - cue.y };
      const distGhost = Math.hypot(toGhost.x, toGhost.y);
      if (distGhost < 1) continue;
      const cueDir = { x: toGhost.x / distGhost, y: toGhost.y / distGhost };
      const align = cueDir.x * dir.x + cueDir.y * dir.y;
      if (align < 0.15) continue;
      const score = align * 2 - (distGhost + distPocket) / 900;
      if (!best || score > best.score) {
        const power = Math.min(1, Math.max(0.35, (distGhost + distPocket) / 650));
        best = { angle: Math.atan2(toGhost.y, toGhost.x), power, score };
      }
    }
  }

  if (best) {
    const jitter = (Math.random() - 0.5) * 0.05;
    return { angle: best.angle + jitter, power: Math.min(1, Math.max(0.2, best.power + (Math.random() - 0.5) * 0.1)) };
  }

  const fallback = targets[0] ?? state.balls.find((b) => b.id !== 0 && !b.potted);
  if (fallback) return { angle: Math.atan2(fallback.y - cue.y, fallback.x - cue.x), power: 0.55 };
  return { angle: Math.random() * Math.PI * 2, power: 0.5 };
}

export function computerPlacement(state: PoolState): { x: number; y: number } {
  const spots = [
    { x: TABLE_W * 0.25, y: TABLE_H / 2 },
    { x: TABLE_W * 0.2, y: TABLE_H * 0.3 },
    { x: TABLE_W * 0.2, y: TABLE_H * 0.7 },
    { x: TABLE_W * 0.5, y: TABLE_H / 2 },
  ];
  for (const s of spots) {
    if (canPlaceCueBall(state.balls, s.x, s.y)) return s;
  }
  return { x: BALL_R * 2, y: BALL_R * 2 };
}
