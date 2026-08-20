import { describe, expect, it } from "vitest";
import {
  KnockHockeyState,
  RoundResult,
  applyRoundResult,
  initialKnockHockey,
  pointsForStreak,
} from "./knock-hockey-run";

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, goals: 0, attempts: 0, bestStreak: 0, ...partial };
}

describe("knock-hockey-run", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialKnockHockey();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a normal goal (below streak threshold) is worth 1, a hot-streak goal is worth 2", () => {
    expect(pointsForStreak(0)).toBe(1);
    expect(pointsForStreak(2)).toBe(1);
    expect(pointsForStreak(3)).toBe(2);
    expect(pointsForStreak(5)).toBe(2);
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialKnockHockey();
    const next = applyRoundResult(s, 0, round({ points: 7, goals: 5, attempts: 9, bestStreak: 3 }));
    expect(next.scores[0]).toBe(7);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRound?.seat).toBe(0);
  });

  it("tracks goals separately from points", () => {
    const s = initialKnockHockey();
    const next = applyRoundResult(s, 1, round({ points: 10, goals: 7, attempts: 12 }));
    expect(next.goals[1]).toBe(7);
    expect(next.goals[0]).toBe(0);
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: KnockHockeyState = { ...initialKnockHockey(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 8, goals: 6 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a round
    s = applyRoundResult(s, 1, round({ points: 5, goals: 4 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: KnockHockeyState = { ...initialKnockHockey(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 6, goals: 5 }));
    s = applyRoundResult(s, 1, round({ points: 6, goals: 4 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("hands the round back to whoever still owes one, not strictly alternating once a side is done", () => {
    let s: KnockHockeyState = { ...initialKnockHockey(), maxRounds: 2 };
    s = applyRoundResult(s, 0, round({ points: 4, goals: 3 })); // seat0: 1/2, -> seat1
    s = applyRoundResult(s, 1, round({ points: 3, goals: 2 })); // seat1: 1/2, -> seat0
    s = applyRoundResult(s, 0, round({ points: 5, goals: 4 })); // seat0: 2/2 done, seat1 still owes -> seat1
    expect(s.possession).toBe(1);
    expect(s.phase).toBe("active");
  });
});
