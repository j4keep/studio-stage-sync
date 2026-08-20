/**
 * Pop Shot as a real-time arcade shooter: each "round" is one player shooting
 * hoops for ROUND_SECONDS straight, same "attempt-based" pattern as Driving's
 * runs or a shot in Pool — the round itself is fully local/ephemeral, only the
 * *result* is persisted here, and possession of "whose round is next"
 * alternates the same way turns do in every other game in this app.
 */

export type Seat = 0 | 1;

export type RoundResult = {
  points: number;
  makes: number;
  attempts: number;
  bestStreak: number;
};

export type RoundLog = { seat: Seat; result: RoundResult };

export type PopShotPhase = "active" | "over";

export type PopShotState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  makes: [number, number];
  /** Whose round is up next. */
  possession: Seat;
  maxRounds: number;
  phase: PopShotPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;
export const ROUND_SECONDS = 24;
/** Consecutive makes needed before a shot starts paying the streak bonus. */
export const STREAK_THRESHOLD = 3;
export const NORMAL_POINTS = 2;
export const STREAK_POINTS = 3;

export function initialPopShot(): PopShotState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    makes: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: PopShotState, seat: Seat, result: RoundResult): PopShotState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const makes: [number, number] = [...state.makes] as [number, number];
  makes[seat] += result.makes;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: PopShotPhase = "active";
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
    makes,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}

/** Points a made shot is worth given the streak of makes *before* this one (0 = no streak yet). */
export function pointsForStreak(priorStreak: number): number {
  return priorStreak >= STREAK_THRESHOLD ? STREAK_POINTS : NORMAL_POINTS;
}
