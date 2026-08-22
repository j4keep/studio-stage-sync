/**
 * YAJ Sugar Rush versus mode: each "round" is one player swapping candies for
 * ROUND_SECONDS straight, same attempt-based pattern as Pop Shot's shootout or a Driving
 * run — the round itself is fully local, only the *result* is persisted here, and
 * possession alternates the same way turns do in every other game in this app.
 */

export type Seat = 0 | 1;

export type RoundResult = {
  score: number;
  bestCascade: number;
  candiesCleared: number;
};

export type RoundLog = { seat: Seat; result: RoundResult };

export type SugarRushPhase = "active" | "over";

export type SugarRushState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  candiesCleared: [number, number];
  /** Whose round is up next. */
  possession: Seat;
  maxRounds: number;
  phase: SugarRushPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 2;
export const ROUND_SECONDS = 60;

export function initialSugarRush(): SugarRushState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    candiesCleared: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: SugarRushState, seat: Seat, result: RoundResult): SugarRushState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const candiesCleared: [number, number] = [...state.candiesCleared] as [number, number];
  candiesCleared[seat] += result.candiesCleared;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: SugarRushPhase = "active";
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
    candiesCleared,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}
