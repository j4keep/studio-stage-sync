/**
 * Mini Golf as a real-time attempt: each "round" is one player putting through a single
 * hole, same "attempt-based" pattern as Pop Shot/Knock Hockey/Word Link — the round itself
 * is fully local/ephemeral (physics tick, walls, hazards all live in the board component),
 * only the *result* is persisted here, and possession of "whose round is next" alternates
 * the same way turns do in every other game in this app.
 *
 * Course geometry lives in a fixed logical coordinate space (COURSE_W x COURSE_H) that the
 * board scales to fill the screen via an SVG viewBox, same trick Knock Hockey uses for its
 * rink so the physics tick never has to know about real device pixels.
 */

export type Seat = 0 | 1;

export type Wall = { x: number; y: number; w: number; h: number };
export type Hazard = { type: "water" | "sand"; x: number; y: number; w: number; h: number };

export type Hole = {
  name: string;
  par: number;
  start: { x: number; y: number };
  cup: { x: number; y: number };
  cupRadius: number;
  walls: Wall[];
  hazards: Hazard[];
};

export const COURSE_W = 480;
export const COURSE_H = 900;

export const HOLES: Hole[] = [
  {
    name: "Front Nine",
    par: 2,
    start: { x: 240, y: 805 },
    cup: { x: 240, y: 118 },
    cupRadius: 16,
    walls: [],
    hazards: [],
  },
  {
    name: "Dogleg Left",
    par: 3,
    start: { x: 120, y: 805 },
    cup: { x: 360, y: 130 },
    cupRadius: 16,
    walls: [{ x: 0, y: 450, w: 300, h: 24 }],
    hazards: [],
  },
  {
    name: "Pond Crossing",
    par: 3,
    start: { x: 240, y: 805 },
    cup: { x: 240, y: 118 },
    cupRadius: 16,
    walls: [],
    hazards: [{ type: "water", x: 285, y: 438, w: 150, h: 107 }],
  },
  {
    name: "Sand Trap",
    par: 3,
    start: { x: 240, y: 805 },
    cup: { x: 240, y: 118 },
    cupRadius: 15,
    walls: [],
    hazards: [{ type: "sand", x: 150, y: 379, w: 180, h: 166 }],
  },
  {
    name: "The Gate",
    par: 4,
    start: { x: 240, y: 829 },
    cup: { x: 240, y: 107 },
    cupRadius: 15,
    walls: [
      { x: 0, y: 474, w: 185, h: 22 },
      { x: 295, y: 474, w: 185, h: 22 },
    ],
    hazards: [],
  },
  {
    name: "Switchback",
    par: 4,
    start: { x: 110, y: 829 },
    cup: { x: 370, y: 107 },
    cupRadius: 15,
    walls: [
      { x: 0, y: 568, w: 145, h: 22 },
      { x: 255, y: 568, w: 225, h: 22 },
      { x: 0, y: 308, w: 239, h: 22 },
      { x: 349, y: 308, w: 131, h: 22 },
    ],
    hazards: [],
  },
];

/** A shuffled, non-repeating order to hand out holes across a match's rounds. */
export function shuffleHoles(rand: () => number = Math.random): Hole[] {
  const arr = [...HOLES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const MAX_STROKES = 6;
export const ROUND_SECONDS = 50;
export const HOLE_IN_ONE_POINTS = 10;

/** Points for sinking a hole in a given number of strokes; 0 if it never went in. */
export function scoreForHole(hole: Hole, strokes: number, sunk: boolean): number {
  if (!sunk) return 0;
  if (strokes <= 1) return HOLE_IN_ONE_POINTS;
  const diff = hole.par - strokes;
  return Math.max(1, 5 + diff * 2);
}

export type RoundResult = {
  points: number;
  strokes: number;
  sunk: boolean;
  holeName: string;
};

export type RoundLog = { seat: Seat; result: RoundResult };
export type MiniGolfPhase = "active" | "over";

export type MiniGolfState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  strokesTaken: [number, number];
  possession: Seat;
  maxRounds: number;
  phase: MiniGolfPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;

export function initialMiniGolf(): MiniGolfState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    strokesTaken: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: MiniGolfState, seat: Seat, result: RoundResult): MiniGolfState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const strokesTaken: [number, number] = [...state.strokesTaken] as [number, number];
  strokesTaken[seat] += result.strokes;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: MiniGolfPhase = "active";
  let winnerSeat: Seat | null = null;
  let possession: Seat = state.possession;

  if (bothDone) {
    phase = "over";
    winnerSeat = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  } else {
    possession = roundsPlayed[oppSeat] < state.maxRounds ? oppSeat : seat;
  }

  return {
    ...state,
    scores,
    roundsPlayed,
    strokesTaken,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}
