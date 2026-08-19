/**
 * Driving as a real-time lane-dodge racer: each "run" is one player weaving
 * through traffic for as much distance as they can before crashing, or
 * finishing the stretch clean. The run itself is fully local/ephemeral (like a
 * shot in Pool, or a drive in Football) — only the *result* is persisted here,
 * and possession of "whose run is next" alternates the same way turns do in
 * every other game in this app.
 */

export type Seat = 0 | 1;

export type RunResult = {
  distance: number;
  boosts: number;
  finished: boolean;
  score: number;
};

export type RunLog = { seat: Seat; result: RunResult };

export type DrivingRunPhase = "active" | "over";

export type DrivingRunState = {
  scores: [number, number];
  runsPlayed: [number, number];
  finishes: [number, number];
  /** Whose run is up next. */
  possession: Seat;
  maxRuns: number;
  phase: DrivingRunPhase;
  winnerSeat: Seat | null;
  lastRun: RunLog | null;
  runNumber: number;
};

export const MAX_RUNS_PER_SIDE = 3;
export const DISTANCE_POINTS = 1;
export const BOOST_POINTS = 30;
export const FINISH_POINTS = 400;
export const TRACK_LENGTH = 100;
export const LANE_COUNT = 4;

export type TrackItem = { distance: number; lane: number; kind: "car" | "boost" };

/** Lays out traffic and boost pickups down the track, injectable RNG for tests. */
export function spawnTrack(rand: () => number = Math.random): TrackItem[] {
  const items: TrackItem[] = [];
  let d = 14;
  while (d < TRACK_LENGTH - 4) {
    const kind: TrackItem["kind"] = rand() < 0.22 ? "boost" : "car";
    const lane = Math.floor(rand() * LANE_COUNT);
    items.push({ distance: d, lane, kind });
    d += 7 + rand() * 6;
  }
  return items;
}

export function initialDrivingRun(): DrivingRunState {
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

export function scoreRun(distance: number, boosts: number, finished: boolean): number {
  return Math.round(Math.max(0, distance) * DISTANCE_POINTS + boosts * BOOST_POINTS + (finished ? FINISH_POINTS : 0));
}

/** Applies a finished run's result and hands the next run to the other seat. */
export function applyRunResult(state: DrivingRunState, seat: Seat, result: RunResult): DrivingRunState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const runsPlayed: [number, number] = [...state.runsPlayed] as [number, number];
  runsPlayed[seat] += 1;
  const finishes: [number, number] = [...state.finishes] as [number, number];
  if (result.finished) finishes[seat] += 1;

  const bothDone = runsPlayed[0] >= state.maxRuns && runsPlayed[1] >= state.maxRuns;
  let phase: DrivingRunPhase = "active";
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
