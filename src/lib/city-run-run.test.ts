import { describe, expect, it } from "vitest";
import {
  CHECKPOINTS,
  CityRunState,
  FINISH_DISTANCE,
  JUNCTION_END,
  JUNCTION_START,
  LANE_COUNT,
  RunResult,
  SECTIONS,
  applyRunResult,
  generateCourse,
  initialCityRun,
  scoreRun,
  sectionAt,
} from "./city-run-run";

function run(partial: Partial<RunResult>): RunResult {
  return { distance: 0, stars: 0, checkpoints: 0, stumbles: 0, finished: false, score: 0, ...partial };
}

describe("city-run-run — course structure", () => {
  it("sections are ordered, non-overlapping except for the one alley/main_street branch", () => {
    const nonBranch = SECTIONS.filter((s) => s.id !== "alley" && s.id !== "main_street");
    for (let i = 1; i < nonBranch.length; i++) {
      expect(nonBranch[i].start).toBeGreaterThanOrEqual(nonBranch[i - 1].end);
    }
    const alley = SECTIONS.find((s) => s.id === "alley")!;
    const mainStreet = SECTIONS.find((s) => s.id === "main_street")!;
    expect(alley.start).toBe(mainStreet.start);
    expect(alley.end).toBe(mainStreet.end);
    expect(alley.start).toBe(JUNCTION_END);
  });

  it("every section ends at or before the finish, and the junction sits before the branch", () => {
    SECTIONS.forEach((s) => expect(s.end).toBeLessThanOrEqual(FINISH_DISTANCE));
    expect(JUNCTION_START).toBeLessThan(JUNCTION_END);
    expect(JUNCTION_END).toBeLessThanOrEqual(SECTIONS.find((s) => s.id === "alley")!.start);
  });

  it("checkpoints are ordered and fall inside the course", () => {
    expect(CHECKPOINTS.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < CHECKPOINTS.length; i++) expect(CHECKPOINTS[i]).toBeGreaterThan(CHECKPOINTS[i - 1]);
    CHECKPOINTS.forEach((c) => {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(FINISH_DISTANCE);
    });
  });

  it("sectionAt resolves the correct branch and returns null in transitional zones", () => {
    expect(sectionAt(50, "main_street")?.id).toBe("street_start");
    expect(sectionAt(200, "alley")?.id).toBe("alley");
    expect(sectionAt(200, "main_street")?.id).toBe("main_street");
    expect(sectionAt((JUNCTION_START + JUNCTION_END) / 2, "main_street")).toBeNull(); // the fork itself
    expect(sectionAt(330, "main_street")).toBeNull(); // the rooftop ramp gap
  });

  it("generateCourse lays out items within bounds, valid lanes, one item per distance step per section", () => {
    const items = generateCourse(() => 0.5);
    expect(items.length).toBeGreaterThan(10);
    items.forEach((item) => {
      expect(item.distance).toBeGreaterThan(0);
      expect(item.distance).toBeLessThan(FINISH_DISTANCE);
      expect(item.lane).toBeGreaterThanOrEqual(0);
      expect(item.lane).toBeLessThan(LANE_COUNT);
    });
    const bySection = new Map<string, number[]>();
    items.forEach((it) => {
      const list = bySection.get(it.sectionId) ?? [];
      list.push(it.distance);
      bySection.set(it.sectionId, list);
    });
    bySection.forEach((distances) => {
      const sorted = [...distances].sort((a, b) => a - b);
      expect(new Set(sorted).size).toBe(sorted.length); // never two items at the same distance
    });
  });

  it("every seeded course is identical for the same RNG, so runs are reproducible for testing", () => {
    const a = generateCourse(() => 0.3);
    const b = generateCourse(() => 0.3);
    expect(a).toEqual(b);
  });
});

describe("city-run-run — scoring and round flow", () => {
  it("scores a run from distance, stars, checkpoints, and a finish bonus", () => {
    expect(scoreRun(100, 2, 1, false)).toBe(85);
    expect(scoreRun(590, 5, 3, true)).toBe(622);
    expect(scoreRun(-5, 0, 0, false)).toBe(0);
  });

  it("starts with seat 0 up first, no runs played, active", () => {
    const s = initialCityRun();
    expect(s.possession).toBe(0);
    expect(s.runsPlayed).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished run credits the acting seat and hands the next run to the other seat", () => {
    const s = initialCityRun();
    const next = applyRunResult(s, 0, run({ distance: 300, stars: 2, checkpoints: 1, score: 130 }));
    expect(next.scores[0]).toBe(130);
    expect(next.runsPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.lastRun?.seat).toBe(0);
  });

  it("tracks finish counts separately from score", () => {
    const s = initialCityRun();
    const next = applyRunResult(s, 1, run({ distance: FINISH_DISTANCE, finished: true, score: 500 }));
    expect(next.finishes[1]).toBe(1);
    expect(next.finishes[0]).toBe(0);
  });

  it("ends the match once both sides have used all their runs, higher score wins", () => {
    let s: CityRunState = { ...initialCityRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ score: 400, finished: true }));
    expect(s.phase).toBe("active");
    s = applyRunResult(s, 1, run({ score: 100 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: CityRunState = { ...initialCityRun(), maxRuns: 1 };
    s = applyRunResult(s, 0, run({ score: 50 }));
    s = applyRunResult(s, 1, run({ score: 50 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });
});
