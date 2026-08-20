/**
 * Snake Royale as a real-time arcade run: each "round" is one player steering a snake around
 * a shrinking grid for up to ROUND_SECONDS, same "attempt-based" pattern as Pop Shot/Knock
 * Hockey/Mini Golf — the round itself (grid, food, the shrinking play zone) is fully
 * local/ephemeral and lives in the board component; only the *result* is persisted here, and
 * possession of "whose round is next" alternates the same way turns do in every other game in
 * this app.
 *
 * The "Royale" twist: the play zone shrinks in stages as the clock runs down, so surviving to
 * the very end (rather than just eating food early and coasting) is what separates a good
 * score from a great one.
 */

export type Seat = 0 | 1;

export type RoundResult = {
  points: number;
  length: number;
  foodEaten: number;
  survived: boolean;
};

export type RoundLog = { seat: Seat; result: RoundResult };

export type SnakeRoyalePhase = "active" | "over";

export type SnakeRoyaleState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  foodEaten: [number, number];
  /** Whose round is up next. */
  possession: Seat;
  maxRounds: number;
  phase: SnakeRoyalePhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;
export const ROUND_SECONDS = 45;
export const POINTS_PER_FOOD = 2;
/** Bonus for surviving to the end of the clock instead of dying to a wall/self/the shrinking zone. */
export const SURVIVAL_BONUS = 10;

export function initialSnakeRoyale(): SnakeRoyaleState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    foodEaten: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** A run's total score: food eaten plus the survival bonus if the clock ran out before the snake died. */
export function scoreForRun(foodEaten: number, survived: boolean): number {
  return foodEaten * POINTS_PER_FOOD + (survived ? SURVIVAL_BONUS : 0);
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: SnakeRoyaleState, seat: Seat, result: RoundResult): SnakeRoyaleState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const foodEaten: [number, number] = [...state.foodEaten] as [number, number];
  foodEaten[seat] += result.foodEaten;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: SnakeRoyalePhase = "active";
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
    foodEaten,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}
