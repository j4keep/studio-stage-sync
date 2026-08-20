import { describe, expect, it } from "vitest";
import {
  RoundResult,
  SnakeRoyaleState,
  applyRoundResult,
  initialSnakeRoyale,
  scoreForRun,
} from "./snake-royale-run";

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, length: 0, foodEaten: 0, survived: false, ...partial };
}

describe("snake-royale-run — scoring", () => {
  it("each food eaten is worth the fixed per-food points", () => {
    expect(scoreForRun(0, false)).toBe(0);
    expect(scoreForRun(5, false)).toBe(10);
  });

  it("surviving to the end of the clock adds the survival bonus on top", () => {
    expect(scoreForRun(5, true)).toBe(10 + 10);
    expect(scoreForRun(0, true)).toBe(10);
  });
});

describe("snake-royale-run — round flow", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialSnakeRoyale();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialSnakeRoyale();
    const next = applyRoundResult(s, 0, round({ points: 16, length: 9, foodEaten: 8, survived: true }));
    expect(next.scores[0]).toBe(16);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.foodEaten[0]).toBe(8);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRound?.seat).toBe(0);
  });

  it("tracks food eaten separately per seat", () => {
    const s = initialSnakeRoyale();
    const next = applyRoundResult(s, 1, round({ points: 12, foodEaten: 6 }));
    expect(next.foodEaten[1]).toBe(6);
    expect(next.foodEaten[0]).toBe(0);
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: SnakeRoyaleState = { ...initialSnakeRoyale(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 20 }));
    expect(s.phase).toBe("active");
    s = applyRoundResult(s, 1, round({ points: 14 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: SnakeRoyaleState = { ...initialSnakeRoyale(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 10 }));
    s = applyRoundResult(s, 1, round({ points: 10 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("hands the round back to whoever still owes one, not strictly alternating once a side is done", () => {
    let s: SnakeRoyaleState = { ...initialSnakeRoyale(), maxRounds: 2 };
    s = applyRoundResult(s, 0, round({ points: 4 })); // seat0: 1/2, -> seat1
    s = applyRoundResult(s, 1, round({ points: 3 })); // seat1: 1/2, -> seat0
    s = applyRoundResult(s, 0, round({ points: 5 })); // seat0: 2/2 done, seat1 still owes -> seat1
    expect(s.possession).toBe(1);
    expect(s.phase).toBe("active");
  });
});
