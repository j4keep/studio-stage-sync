import { describe, expect, it } from "vitest";
import {
  PopShotState,
  RoundResult,
  applyRoundResult,
  initialPopShot,
  pointsForStreak,
} from "./pop-shot-run";

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, makes: 0, attempts: 0, bestStreak: 0, ...partial };
}

describe("pop-shot-run", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialPopShot();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a normal make (below streak threshold) is worth 2, a hot-streak make is worth 3", () => {
    expect(pointsForStreak(0)).toBe(2);
    expect(pointsForStreak(2)).toBe(2);
    expect(pointsForStreak(3)).toBe(3);
    expect(pointsForStreak(5)).toBe(3);
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialPopShot();
    const next = applyRoundResult(s, 0, round({ points: 14, makes: 6, attempts: 10, bestStreak: 4 }));
    expect(next.scores[0]).toBe(14);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRound?.seat).toBe(0);
  });

  it("tracks makes separately from points", () => {
    const s = initialPopShot();
    const next = applyRoundResult(s, 1, round({ points: 20, makes: 8, attempts: 12 }));
    expect(next.makes[1]).toBe(8);
    expect(next.makes[0]).toBe(0);
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: PopShotState = { ...initialPopShot(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 20, makes: 8 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a round
    s = applyRoundResult(s, 1, round({ points: 10, makes: 4 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: PopShotState = { ...initialPopShot(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 16, makes: 7 }));
    s = applyRoundResult(s, 1, round({ points: 16, makes: 6 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("hands the round back to whoever still owes one, not strictly alternating once a side is done", () => {
    let s: PopShotState = { ...initialPopShot(), maxRounds: 2 };
    s = applyRoundResult(s, 0, round({ points: 10, makes: 4 })); // seat0: 1/2, -> seat1
    s = applyRoundResult(s, 1, round({ points: 8, makes: 3 })); // seat1: 1/2, -> seat0
    s = applyRoundResult(s, 0, round({ points: 12, makes: 5 })); // seat0: 2/2 done, seat1 still owes -> seat1
    expect(s.possession).toBe(1);
    expect(s.phase).toBe("active");
  });
});
