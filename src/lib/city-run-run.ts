/**
 * YAJ City Run as a real-time lane-dash: each "run" is one player weaving through a
 * three-lane city street for as much distance as they can before an obstacle catches them, or
 * finishing the stretch clean — same "attempt-based" pattern as Driving's runs. The run itself
 * is fully local/ephemeral, only the *result* is persisted here, and possession of "whose run
 * is next" alternates the same way turns do in every other game in this app.
 *
 * Only one item — an obstacle or a star — ever spawns at a given distance, always in a single
 * lane, so the other two lanes are guaranteed clear: a lane change alone is always enough to
 * get through safely. Jumping and sliding are faster alternatives for staying in your lane
 * through a ground or overhead obstacle, never the only way past one.
 */

export type Seat = 0 | 1;
export type Lane = 0 | 1 | 2;

/** Ground obstacles are cleared by jumping (or changing lanes). */
export type GroundKind = "cone" | "trash" | "barrier" | "puddle";
/** Overhead obstacles are cleared by sliding (or changing lanes) — jumping into one still hits it. */
export type OverheadKind = "sign";
export type ObstacleKind = GroundKind | OverheadKind;
export type ItemKind = ObstacleKind | "star";

export type TrackItem = { distance: number; lane: Lane; kind: ItemKind };

export const TRACK_LENGTH = 100;
export const LANE_COUNT = 3;
export const GROUND_KINDS: GroundKind[] = ["cone", "trash", "barrier", "puddle"];
export const OVERHEAD_KINDS: OverheadKind[] = ["sign"];

/** Lays out one obstacle-or-star per distance step, each in a single random lane, injectable
 *  RNG for tests. Never more than one item per step, so two of the three lanes are always open. */
export function spawnCourse(rand: () => number = Math.random): TrackItem[] {
  const items: TrackItem[] = [];
  let d = 14;
  while (d < TRACK_LENGTH - 4) {
    const lane = Math.floor(rand() * LANE_COUNT) as Lane;
    const roll = rand();
    let kind: ItemKind;
    if (roll < 0.3) {
      kind = "star";
    } else if (roll < 0.42) {
      kind = OVERHEAD_KINDS[0];
    } else {
      const idx = Math.min(GROUND_KINDS.length - 1, Math.floor(((roll - 0.42) / 0.58) * GROUND_KINDS.length));
      kind = GROUND_KINDS[idx];
    }
    items.push({ distance: d, lane, kind });
    d += 8 + rand() * 6;
  }
  return items;
}

export type RunResult = {
  distance: number;
  stars: number;
  finished: boolean;
  score: number;
};

export type RunLog = { seat: Seat; result: RunResult };

export type CityRunPhase = "active" | "over";

export type CityRunState = {
  scores: [number, number];
  runsPlayed: [number, number];
  finishes: [number, number];
  /** Whose run is up next. */
  possession: Seat;
  maxRuns: number;
  phase: CityRunPhase;
  winnerSeat: Seat | null;
  lastRun: RunLog | null;
  runNumber: number;
};

export const MAX_RUNS_PER_SIDE = 3;
export const DISTANCE_POINTS = 1;
export const STAR_POINTS = 20;
export const FINISH_POINTS = 350;

export function initialCityRun(): CityRunState {
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

export function scoreRun(distance: number, stars: number, finished: boolean): number {
  return Math.round(Math.max(0, distance) * DISTANCE_POINTS + stars * STAR_POINTS + (finished ? FINISH_POINTS : 0));
}

/** Applies a finished run's result and hands the next run to the other seat. */
export function applyRunResult(state: CityRunState, seat: Seat, result: RunResult): CityRunState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const runsPlayed: [number, number] = [...state.runsPlayed] as [number, number];
  runsPlayed[seat] += 1;
  const finishes: [number, number] = [...state.finishes] as [number, number];
  if (result.finished) finishes[seat] += 1;

  const bothDone = runsPlayed[0] >= state.maxRuns && runsPlayed[1] >= state.maxRuns;
  let phase: CityRunPhase = "active";
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
