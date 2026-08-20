/**
 * Tumble Guys as a real-time obstacle-course dash: each "run" is one player auto-running down
 * a straight course, tapping to jump every hazard, for as much distance as they can before
 * tumbling, or finishing the course clean — same "attempt-based" pattern as Driving's runs. The
 * run itself is fully local/ephemeral, only the *result* is persisted here, and possession of
 * "whose run is next" alternates the same way turns do in every other game in this app.
 *
 * Every hazard (gap, spinning bar, swinging hammer) works the same underlying way: it's lethal
 * unless the runner is airborne for its entire width, so a single "tap to jump" input is all
 * the control this game ever needs — the different hazard kinds are visual flavor in the board,
 * not different rules.
 */

export type Seat = 0 | 1;

export type RunResult = {
  distance: number;
  coins: number;
  finished: boolean;
  score: number;
};

export type RunLog = { seat: Seat; result: RunResult };

export type TumbleRunPhase = "active" | "over";

export type TumbleRunState = {
  scores: [number, number];
  runsPlayed: [number, number];
  finishes: [number, number];
  /** Whose run is up next. */
  possession: Seat;
  maxRuns: number;
  phase: TumbleRunPhase;
  winnerSeat: Seat | null;
  lastRun: RunLog | null;
  runNumber: number;
};

export const MAX_RUNS_PER_SIDE = 3;
export const DISTANCE_POINTS = 1;
export const COIN_POINTS = 15;
export const FINISH_POINTS = 300;
export const TRACK_LENGTH = 100;

export type ObstacleKind = "gap" | "bar" | "swinger";
export type Obstacle = { distance: number; width: number; kind: ObstacleKind };
export type Coin = { distance: number };

/** A hazard's ground footprint — must stay at or under the runner's jump reach so every
 *  obstacle the course generates is always survivable with correctly-timed taps. */
export const OBSTACLE_WIDTH = 4;

export type Course = { obstacles: Obstacle[]; coins: Coin[] };

/** Lays out hazards and coins down the course, injectable RNG for tests. */
export function spawnCourse(rand: () => number = Math.random): Course {
  const kinds: ObstacleKind[] = ["gap", "bar", "swinger"];
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  let d = 16;
  while (d < TRACK_LENGTH - 6) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    obstacles.push({ distance: d, width: OBSTACLE_WIDTH, kind });
    if (rand() < 0.45) coins.push({ distance: d - 5 });
    d += 12 + rand() * 8;
  }
  return { obstacles, coins };
}

export function initialTumbleRun(): TumbleRunState {
  return {
    scores: [0, 0],
    runsPlayed: [0, 0],
    finishes: [0, 0],
    possession: 0,
    maxRuns: MAX_RUNS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRun: null,
    runNumber: 0,
  };
}

export function scoreRun(distance: number, coins: number, finished: boolean): number {
  return Math.round(Math.max(0, distance) * DISTANCE_POINTS + coins * COIN_POINTS + (finished ? FINISH_POINTS : 0));
}

/** Applies a finished run's result and hands the next run to the other seat. */
export function applyRunResult(state: TumbleRunState, seat: Seat, result: RunResult): TumbleRunState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const runsPlayed: [number, number] = [...state.runsPlayed] as [number, number];
  runsPlayed[seat] += 1;
  const finishes: [number, number] = [...state.finishes] as [number, number];
  if (result.finished) finishes[seat] += 1;

  const bothDone = runsPlayed[0] >= state.maxRuns && runsPlayed[1] >= state.maxRuns;
  let phase: TumbleRunPhase = "active";
  let winnerSeat: Seat | null = null;
  let possession: Seat = state.possession;

  if (bothDone) {
    phase = "over";
    winnerSeat = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  } else {
    possession = runsPlayed[oppSeat] < state.maxRuns ? oppSeat : seat;
  }

  return {
    ...state,
    scores,
    runsPlayed,
    finishes,
    possession,
    phase,
    winnerSeat,
    lastRun: { seat, result },
    runNumber: state.runNumber + 1,
  };
}
