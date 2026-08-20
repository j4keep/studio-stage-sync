import { describe, expect, it } from "vitest";
import {
  BingoState,
  CARD_SIZE,
  COLUMN_RANGES,
  FREE,
  RoundResult,
  applyRoundResult,
  generateCard,
  generateDrawSequence,
  hasBingo,
  initialBingo,
  markedGrid,
  pointsForDraws,
} from "./bingo-run";

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, drawsUsed: 0, won: false, ...partial };
}

describe("bingo-run — card and draw generation", () => {
  it("generates a 5x5 card with each column drawn from its own range, no repeats, center free", () => {
    const card = generateCard(() => 0.42);
    expect(card).toHaveLength(CARD_SIZE);
    card.forEach((row) => expect(row).toHaveLength(CARD_SIZE));
    expect(card[2][2]).toBe(FREE);
    for (let col = 0; col < CARD_SIZE; col++) {
      const [lo, hi] = COLUMN_RANGES[col];
      const seen = new Set<number>();
      for (let row = 0; row < CARD_SIZE; row++) {
        if (row === 2 && col === 2) continue; // free space
        const n = card[row][col];
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
        expect(seen.has(n)).toBe(false);
        seen.add(n);
      }
    }
  });

  it("generates a draw sequence covering every number 1-75 exactly once", () => {
    const seq = generateDrawSequence(() => 0.7);
    expect(seq).toHaveLength(75);
    expect(new Set(seq).size).toBe(75);
    seq.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(75);
    });
  });
});

describe("bingo-run — line detection", () => {
  it("detects a completed row", () => {
    const marked = [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, true, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ];
    expect(hasBingo(marked)).toBe(true);
  });

  it("detects a completed column", () => {
    const marked = [
      [false, true, false, false, false],
      [false, true, false, false, false],
      [false, true, true, false, false],
      [false, true, false, false, false],
      [false, true, false, false, false],
    ];
    expect(hasBingo(marked)).toBe(true);
  });

  it("detects the two diagonals", () => {
    const mainDiag = [
      [true, false, false, false, false],
      [false, true, false, false, false],
      [false, false, true, false, false],
      [false, false, false, true, false],
      [false, false, false, false, true],
    ];
    expect(hasBingo(mainDiag)).toBe(true);

    const antiDiag = [
      [false, false, false, false, true],
      [false, false, false, true, false],
      [false, false, true, false, false],
      [false, true, false, false, false],
      [true, false, false, false, false],
    ];
    expect(hasBingo(antiDiag)).toBe(true);
  });

  it("is false when nothing lines up", () => {
    const marked = [
      [true, false, false, false, false],
      [false, false, false, false, true],
      [false, true, true, false, false],
      [false, false, false, true, false],
      [false, false, true, false, false],
    ];
    expect(hasBingo(marked)).toBe(false);
  });

  it("markedGrid treats the free space as always marked", () => {
    const card = generateCard(() => 0.1);
    const marked = markedGrid(card, new Set());
    expect(marked[2][2]).toBe(true);
    expect(marked[0][0]).toBe(false);
  });

  it("markedGrid marks any card number that's been called", () => {
    const card = generateCard(() => 0.55);
    const called = new Set([card[0][0], card[3][4]]);
    const marked = markedGrid(card, called);
    expect(marked[0][0]).toBe(true);
    expect(marked[3][4]).toBe(true);
  });
});

describe("bingo-run — scoring and round flow", () => {
  it("a loss (no bingo before the cap) scores zero", () => {
    expect(pointsForDraws(60, false)).toBe(0);
  });

  it("fewer draws used is worth more, with a floor", () => {
    expect(pointsForDraws(5, true)).toBe(45);
    expect(pointsForDraws(45, true)).toBe(10);
    expect(pointsForDraws(60, true)).toBe(10);
  });

  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialBingo();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialBingo();
    const next = applyRoundResult(s, 0, round({ points: 30, drawsUsed: 20, won: true }));
    expect(next.scores[0]).toBe(30);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.bingos[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: BingoState = { ...initialBingo(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 40, drawsUsed: 10, won: true }));
    expect(s.phase).toBe("active");
    s = applyRoundResult(s, 1, round({ points: 20, drawsUsed: 30, won: true }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: BingoState = { ...initialBingo(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 25, won: true }));
    s = applyRoundResult(s, 1, round({ points: 25, won: true }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });
});
