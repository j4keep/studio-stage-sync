import { describe, expect, it } from "vitest";
import {
  RoundResult,
  SugarRushState,
  applyRoundResult,
  initialSugarRush,
} from "./sugar-rush-run";

function round(partial: Partial<RoundResult>): RoundResult {
  return { score: 0, bestCascade: 0, candiesCleared: 0, ...partial };
}

describe("sugar-rush-run", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialSugarRush();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialSugarRush();
    const next = applyRoundResult(s, 0, round({ score: 340, bestCascade: 3, candiesCleared: 22 }));
    expect(next.scores[0]).toBe(340);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRound?.seat).toBe(0);
  });

  it("tracks candies cleared separately from score", () => {
    const s = initialSugarRush();
    const next = applyRoundResult(s, 1, round({ score: 200, candiesCleared: 15 }));
    expect(next.candiesCleared[1]).toBe(15);
    expect(next.candiesCleared[0]).toBe(0);
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: SugarRushState = { ...initialSugarRush(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ score: 500 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a round
    s = applyRoundResult(s, 1, round({ score: 300 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: SugarRushState = { ...initialSugarRush(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ score: 400 }));
    s = applyRoundResult(s, 1, round({ score: 400 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("hands the round back to whoever still owes one, not strictly alternating once a side is done", () => {
    let s: SugarRushState = { ...initialSugarRush(), maxRounds: 2 };
    s = applyRoundResult(s, 0, round({ score: 100 })); // seat0: 1/2, -> seat1
    s = applyRoundResult(s, 1, round({ score: 80 })); // seat1: 1/2, -> seat0
    s = applyRoundResult(s, 0, round({ score: 120 })); // seat0: 2/2 done, seat1 still owes -> seat1
    expect(s.possession).toBe(1);
    expect(s.phase).toBe("active");
  });
});
