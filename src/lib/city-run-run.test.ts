import { describe, expect, it } from "vitest";
import {
  CityRunState,
  GROUND_KINDS,
  LANE_COUNT,
  OVERHEAD_KINDS,
  RunResult,
  TRACK_LENGTH,
  applyRunResult,
  initialCityRun,
  scoreRun,
  spawnCourse,
} from "./city-run-run";

function run(partial: Partial<RunResult>): RunResult {
  return { distance: 0, stars: 0, finished: false, score: 0, ...partial };
}

describe("city-run-run", () => {
  it("starts with seat 0 up first, no runs played, active", () => {
    const s = initialCityRun();
    expect(s.possession).toBe(0);
    expect(s.runsPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("scores a run from distance, stars, and a finish bonus", () => {
    expect(scoreRun(40, 2, false)).toBe(80);
    expect(scoreRun(100, 3, true)).toBe(510);
    expect(scoreRun(-5, 0, false)).toBe(0);
  });

  it("a finished run credits the acting seat and hands the next run to the other seat", () => {
    const s = initialCityRun();
    const next = applyRunResult(s, 0, run({ distance: 30, stars: 1, score: 50 }));
    expect(next.scores[0]).toBe(50);
    expect(next.runsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastRun?.seat).toBe(0);
  });

  it("tracks finish counts separately from score", () => {
    const s = initialCityRun();
    const next = applyRunResult(s, 1, run({ distance: 100, finished: true, score: 450 }));
    expect(next.finishes[1]).toBe(1);
    expect(next.finishes[0]).toBe(0);
  });

  it("ends the match once both sides have used all their runs, higher score wins", () => {
    let s: CityRunState = { ...initialCityRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 100, finished: true, score: 450 }));
    expect(s.phase).toBe("active"); // seat 1 still owes a run
    s = applyRunResult(s, 1, run({ distance: 10, score: 10 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: CityRunState = { ...initialCityRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ distance: 20, score: 20 }));
    s = applyRunResult(s, 1, run({ distance: 20, score: 20 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("spawnCourse lays out items within the track bounds, in increasing order, valid lanes", () => {
    const items = spawnCourse(() => 0.5);
    expect(items.length).toBeGreaterThan(3);
    items.forEach((item) => {
      expect(item.distance).toBeGreaterThan(0);
      expect(item.distance).toBeLessThan(TRACK_LENGTH);
      expect(item.lane).toBeGreaterThanOrEqual(0);
      expect(item.lane).toBeLessThan(LANE_COUNT);
      expect([...GROUND_KINDS, ...OVERHEAD_KINDS, "star"]).toContain(item.kind);
    });
    for (let i = 1; i < items.length; i++) {
      expect(items[i].distance).toBeGreaterThan(items[i - 1].distance);
    }
  });

  it("never places more than one item at the same distance, so at least two lanes are always open", () => {
    const items = spawnCourse(() => 0.37);
    const distances = items.map((i) => i.distance);
    expect(new Set(distances).size).toBe(distances.length);
  });

  it("every seeded course is identical for the same RNG, so runs are reproducible for testing", () => {
    const a = spawnCourse(() => 0.3);
    const b = spawnCourse(() => 0.3);
    expect(a).toEqual(b);
  });
});
