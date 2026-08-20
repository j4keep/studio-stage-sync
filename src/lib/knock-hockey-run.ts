/**
 * Knock Hockey as a real-time arcade shootout: each "round" is one player
 * sliding the puck at a defended goal for ROUND_SECONDS straight, same
 * "attempt-based" pattern as Pop Shot or a run in Driving — the round itself
 * is fully local/ephemeral, only the *result* is persisted here, and
 * possession of "whose round is next" alternates the same way turns do in
 * every other game in this app.
 */

export type Seat = 0 | 1;

export type RoundResult = {
  points: number;
  goals: number;
  attempts: number;
  bestStreak: number;
};

export type RoundLog = { seat: Seat; result: RoundResult };

export type KnockHockeyPhase = "active" | "over";

export type KnockHockeyState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  goals: [number, number];
  /** Whose round is up next. */
  possession: Seat;
  maxRounds: number;
  phase: KnockHockeyPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;
export const ROUND_SECONDS = 20;
/** Consecutive goals needed before a goal starts paying the streak bonus. */
export const STREAK_THRESHOLD = 3;
export const NORMAL_POINTS = 1;
export const STREAK_POINTS = 2;

export function initialKnockHockey(): KnockHockeyState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    goals: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: KnockHockeyState, seat: Seat, result: RoundResult): KnockHockeyState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const goals: [number, number] = [...state.goals] as [number, number];
  goals[seat] += result.goals;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: KnockHockeyPhase = "active";
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
    goals,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}

/** Points a goal is worth given the streak of goals *before* this one (0 = no streak yet). */
export function pointsForStreak(priorStreak: number): number {
  return priorStreak >= STREAK_THRESHOLD ? STREAK_POINTS : NORMAL_POINTS;
}
