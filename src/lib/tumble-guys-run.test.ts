import { describe, expect, it } from "vitest";
import {
  OBSTACLE_WIDTH,
  RunResult,
  TRACK_LENGTH,
  TumbleRunState,
  applyRunResult,
  initialTumbleRun,
  scoreRun,
  spawnCourse,
} from "./tumble-guys-run";

function run(partial: Partial<RunResult>): RunResult {
  return { distance: 0, coins: 0, finished: false, score: 0, ...partial };
}

describe("tumble-guys-run", () => {
  it("starts with seat 0 up first, no runs played, active", () => {
    const s = initialTumbleRun();
    expect(s.possession).toBe(0);
    expect(s.runsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("scores a run from distance, coins, and a finish bonus", () => {
    expect(scoreRun(40, 2, false)).toBe(70);
    expect(scoreRun(100, 3, true)).toBe(445);
    expect(scoreRun(-5, 0, false)).toBe(0);
  });

  it("a finished run credits the acting seat and hands the next run to the other seat", () => {
    const s = initialTumbleRun();
    const next = applyRunResult(s, 0, run({ distance: 30, coins: 1, score: 45 }));
    expect(next.scores[0]).toBe(45);
    expect(next.runsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRun?.seat).toBe(0);
  });

  it("tracks finish counts separately from score", () => {
    const s = initialTumbleRun();
    const next = applyRunResult(s, 1, run({ distance: 100, finished: true, score: 400 }));
    expect(next.finishes[1]).toBe(1);
    expect(next.finishes[0]).toBe(0);
  });

  it("ends the match once both sides have used all their runs, higher score wins", () => {
    let s: TumbleRunState = { ...initialTumbleRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 100, finished: true, score: 400 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a run
    s = applyRunResult(s, 1, run({ distance: 10, score: 10 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: TumbleRunState = { ...initialTumbleRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 20, score: 20 }));
    s = applyRunResult(s, 1, run({ distance: 20, score: 20 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("spawnCourse lays out hazards within the track bounds, in increasing order, spaced apart", () => {
    const { obstacles, coins } = spawnCourse(() => 0.5);
    expect(obstacles.length).toBeGreaterThan(3);
    obstacles.forEach((o) => {
      expect(o.distance).toBeGreaterThan(0);
      expect(o.distance).toBeLessThan(TRACK_LENGTH);
      expect(o.width).toBe(OBSTACLE_WIDTH);
    });
    for (let i = 1; i < obstacles.length; i++) {
      expect(obstacles[i].distance).toBeGreaterThan(obstacles[i - 1].distance);
      // Two hazards must never overlap, or no tap timing could clear both.
      expect(obstacles[i].distance).toBeGreaterThanOrEqual(obstacles[i - 1].distance + obstacles[i - 1].width);
    }
    coins.forEach((c) => {
      expect(c.distance).toBeGreaterThan(0);
      expect(c.distance).toBeLessThan(TRACK_LENGTH);
    });
  });

  it("every seeded course is identical for the same RNG, so runs are reproducible for testing", () => {
    const a = spawnCourse(() => 0.3);
    const b = spawnCourse(() => 0.3);
    expect(a).toEqual(b);
  });
});
