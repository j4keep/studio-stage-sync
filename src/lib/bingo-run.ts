/**
 * Bingo as a real-time race: each "round" is one player watching numbers get called and
 * racing to complete a line, same "attempt-based" pattern as Pop Shot or Knock Hockey — the
 * round itself is fully local/ephemeral, only the *result* is persisted here, and possession
 * of "whose round is next" alternates the same way turns do in every other game in this app.
 */

export type Seat = 0 | 1;

export const CARD_SIZE = 5;
/** Inclusive [low, high] number range for each of the 5 columns (B-I-N-G-O). */
export const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];
/** Sentinel for the free center space — 0 is never a real bingo number. */
export const FREE = 0;

export type BingoCard = number[][];

/** A fresh 5x5 card, each column drawn from its own range with no repeats, center free. */
export function generateCard(rand: () => number = Math.random): BingoCard {
  const grid: number[][] = Array.from({ length: CARD_SIZE }, () => Array(CARD_SIZE).fill(FREE));
  for (let col = 0; col < CARD_SIZE; col++) {
    const [lo, hi] = COLUMN_RANGES[col];
    const pool: number[] = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let row = 0; row < CARD_SIZE; row++) grid[row][col] = pool[row];
  }
  grid[2][2] = FREE;
  return grid;
}

/** A shuffled draw order covering every number 1-75 exactly once. */
export function generateDrawSequence(rand: () => number = Math.random): number[] {
  const nums = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

export function markedGrid(card: BingoCard, called: ReadonlySet<number>): boolean[][] {
  return card.map((row) => row.map((n) => n === FREE || called.has(n)));
}

/** True if any row, column, or the two diagonals are fully marked. */
export function hasBingo(marked: boolean[][]): boolean {
  for (let r = 0; r < CARD_SIZE; r++) if (marked[r].every(Boolean)) return true;
  for (let c = 0; c < CARD_SIZE; c++) if (marked.every((row) => row[c])) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked[i][i])) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked[i][CARD_SIZE - 1 - i])) return true;
  return false;
}

/** Points for claiming bingo after this many numbers called — fewer calls is worth more. */
export function pointsForDraws(drawsUsed: number, won: boolean): number {
  if (!won) return 0;
  return Math.max(10, 50 - drawsUsed);
}

export type RoundResult = {
  points: number;
  drawsUsed: number;
  won: boolean;
};

export type RoundLog = { seat: Seat; result: RoundResult };
export type BingoPhase = "active" | "over";

export type BingoState = {
  scores: [number, number];
  roundsPlayed: [number, number];
  bingos: [number, number];
  possession: Seat;
  maxRounds: number;
  phase: BingoPhase;
  winnerSeat: Seat | null;
  lastRound: RoundLog | null;
  roundNumber: number;
};

export const MAX_ROUNDS_PER_SIDE = 3;
export const MAX_DRAWS = 60;

export function initialBingo(): BingoState {
  return {
    scores: [0, 0],
    roundsPlayed: [0, 0],
    bingos: [0, 0],
    possession: 0,
    maxRounds: MAX_ROUNDS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRound: null,
    roundNumber: 0,
  };
}

/** Applies a finished round's result and hands the next round to the other seat. */
export function applyRoundResult(state: BingoState, seat: Seat, result: RoundResult): BingoState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.points;
  const roundsPlayed: [number, number] = [...state.roundsPlayed] as [number, number];
  roundsPlayed[seat] += 1;
  const bingos: [number, number] = [...state.bingos] as [number, number];
  if (result.won) bingos[seat] += 1;

  const bothDone = roundsPlayed[0] >= state.maxRounds && roundsPlayed[1] >= state.maxRounds;
  let phase: BingoPhase = "active";
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
    bingos,
    possession,
    phase,
    winnerSeat,
    lastRound: { seat, result },
    roundNumber: state.roundNumber + 1,
  };
}
