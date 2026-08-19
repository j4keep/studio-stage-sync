import { describe, expect, it } from "vitest";
import { DrivingRunState, LANE_COUNT, RunResult, TRACK_LENGTH, applyRunResult, initialDrivingRun, scoreRun, spawnTrack } from "./driving-run";

function run(partial: Partial<RunResult>): RunResult {
  return { distance: 0, boosts: 0, finished: false, score: 0, ...partial };
}

describe("driving-run", () => {
  it("starts with seat 0 up first, no runs played, active", () => {
    const s = initialDrivingRun();
    expect(s.possession).toBe(0);
    expect(s.runsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("scores a run from distance, boosts, and a finish bonus", () => {
    expect(scoreRun(40, 2, false)).toBe(100);
    expect(scoreRun(100, 3, true)).toBe(590);
    expect(scoreRun(-5, 0, false)).toBe(0);
  });

  it("a finished run credits the acting seat and hands the next run to the other seat", () => {
    const s = initialDrivingRun();
    const next = applyRunResult(s, 0, run({ distance: 30, boosts: 1, score: 60 }));
    expect(next.scores[0]).toBe(60);
    expect(next.runsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRun?.seat).toBe(0);
  });

  it("tracks finish counts separately from score", () => {
    const s = initialDrivingRun();
    const next = applyRunResult(s, 1, run({ distance: 100, finished: true, score: 500 }));
    expect(next.finishes[1]).toBe(1);
    expect(next.finishes[0]).toBe(0);
  });

  it("ends the game once both sides have used all their runs, higher score wins", () => {
    let s: DrivingRunState = { ...initialDrivingRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 100, finished: true, score: 500 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a run
    s = applyRunResult(s, 1, run({ distance: 10, score: 10 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: DrivingRunState = { ...initialDrivingRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 20, score: 20 }));
    s = applyRunResult(s, 1, run({ distance: 20, score: 20 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("spawnTrack lays out items within the track bounds and valid lanes", () => {
    const items = spawnTrack(() => 0.5);
    expect(items.length).toBeGreaterThan(3);
    items.forEach((item) => {
      expect(item.distance).toBeGreaterThan(0);
      expect(item.distance).toBeLessThan(TRACK_LENGTH);
      expect(item.lane).toBeGreaterThanOrEqual(0);
      expect(item.lane).toBeLessThan(LANE_COUNT);
    });
    for (let i = 1; i < items.length; i++) {
      expect(items[i].distance).toBeGreaterThan(items[i - 1].distance);
    }
  });
});
