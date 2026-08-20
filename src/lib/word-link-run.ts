/**
 * Word Link as a real-time race: each "round" is one player dragging across a wheel of
 * letters to spell as many valid words as they can before time runs out, same "attempt-based"
 * pattern as Pop Shot/Knock Hockey/Bingo — the round itself is fully local/ephemeral, only the
 * *result* is persisted here, and possession of "whose round is next" alternates the same way
 * turns do in every other game in this app.
 *
 * Answers are a hand-curated list per puzzle rather than a bundled dictionary — every word in
 * `words` has been checked to use only letters actually present in `letters` (each letter used
 * at most as many times as it appears), so membership in that list is itself sufficient
 * validation; there's no separate "are these letters available" check needed at runtime.
 */

export type Seat = 0 | 1;

export type WordPuzzle = {
  /** The letters on the wheel, in display order. */
  letters: string;
  /** Every accepted word, uppercase, 3+ letters. */
  words: string[];
};

export const PUZZLES: WordPuzzle[] = [
  {
    letters: "TRAINS",
    words: ["SIT", "TIN", "NIT", "AIR", "TAR", "RAT", "ART", "ARTS", "RATS", "TARS", "STAR", "STIR", "RAIN", "TRAIN", "STAIN", "SAINT", "RAINS", "STRAIN", "TRAINS"],
  },
  {
    letters: "PLANET",
    words: ["PET", "LET", "NET", "APE", "ATE", "EAT", "TEA", "TAP", "LAP", "NAP", "PAN", "PEN", "LEAP", "PALE", "PEAL", "PLAN", "PLATE", "PLANT", "PANEL", "PLANET"],
  },
  {
    letters: "GARDEN",
    words: ["RAG", "RAN", "NEAR", "EARN", "DEAN", "AGED", "RAGE", "DARE", "DEAR", "READ", "GEAR", "GRAD", "GRADE", "ANGER", "RANGE", "GARDEN"],
  },
  {
    letters: "MASTER",
    words: ["ARM", "ARMS", "MAT", "MATS", "RAT", "RATS", "TEAM", "TEAMS", "MEAT", "MEATS", "STAR", "STARE", "STEAM", "SMART", "TEAR", "TEARS", "RATE", "RATES", "TAME", "TAMES", "MASTER"],
  },
  {
    letters: "SILVER",
    words: ["LIE", "REV", "VILE", "LIVE", "EVIL", "VEIL", "RISE", "SIRE", "RILE", "VEILS", "LIVES", "LIVER", "SLIVER"],
  },
  {
    letters: "CANDLE",
    words: ["END", "AND", "ACE", "CAN", "LACE", "ACNE", "CANE", "LAND", "LANE", "LEAD", "DEAL", "DEAN", "LEND", "CLEAN", "DANCE", "CANDLE"],
  },
];

export function scoreWord(word: string): number {
  return word.length;
}

export const ALL_FOUND_BONUS = 20;

/** Sum of points for every word in the puzzle, plus the all-found bonus — the round's ceiling. */
export function maxPossiblePoints(puzzle: WordPuzzle): number {
  return puzzle.words.reduce((sum, w) => sum + scoreWord(w), 0) + ALL_FOUND_BONUS;
}

/** A shuffled, non-repeating order to hand out puzzles across a match's rounds. */
export function shufflePuzzles(rand: () => number = Math.random): WordPuzzle[] {
  const arr = [...PUZZLES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type RoundResult = {
  points: number;
  wordsFound: number;
  totalWords: number;
};

export type RoundLog = { seat: Seat; result: RoundResult };
export type WordLinkPhase = "active" | "over";

export type WordLinkState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  wordsFound: [number, number];
  possession: Seat;
  maxRounds: number;
  phase: WordLinkPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;
export const ROUND_SECONDS = 90;

export function initialWordLink(): WordLinkState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    wordsFound: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: WordLinkState, seat: Seat, result: RoundResult): WordLinkState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const wordsFound: [number, number] = [...state.wordsFound] as [number, number];
  wordsFound[seat] += result.wordsFound;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: WordLinkPhase = "active";
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
    wordsFound,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}
