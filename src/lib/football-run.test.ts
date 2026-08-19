import { describe, expect, it } from "vitest";
import { FootballRunState, applyDriveResult, initialFootballRun, scoreDrive, spawnDefenders } from "./football-run";

describe("football-run", () => {
  it("starts with seat 0 up first, no drives played, active", () => {
    const s = initialFootballRun();
    expect(s.possession).toBe(0);
    expect(s.drivesPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("scores a drive from yards, dodges, and a touchdown bonus", () => {
    expect(scoreDrive(40, 2, false)).toBe(140);
    expect(scoreDrive(100, 3, true)).toBe(750);
    expect(scoreDrive(-5, 0, false)).toBe(0);
  });

  it("a finished drive credits the acting seat and hands the next drive to the other seat", () => {
    const s = initialFootballRun();
    const next = applyDriveResult(s, 0, { yards: 30, dodges: 1, touchdown: false, score: 80 });
    expect(next.scores[0]).toBe(80);
    expect(next.drivesPlayed[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastDrive?.seat).toBe(0);
  });

  it("ends the game once both sides have used all their drives, higher score wins", () => {
    let s: FootballRunState = { ...initialFootballRun(), maxDrives: 1 };
    s = applyDriveResult(s, 0, { yards: 100, dodges: 0, touchdown: true, score: 600 });
    expect(s.phase).toBe("active"); // seat 1 still owes a drive
    s = applyDriveResult(s, 1, { yards: 10, dodges: 0, touchdown: false, score: 10 });
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: FootballRunState = { ...initialFootballRun(), maxDrives: 1 };
    s = applyDriveResult(s, 0, { yards: 20, dodges: 0, touchdown: false, score: 20 });
    s = applyDriveResult(s, 1, { yards: 20, dodges: 0, touchdown: false, score: 20 });
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });

  it("spawns defenders spread across the field within lane bounds", () => {
    const spawns = spawnDefenders(6, () => 0.5);
    expect(spawns).toHaveLength(6);
    spawns.forEach((d) => {
      expect(d.yardLine).toBeGreaterThan(0);
      expect(d.yardLine).toBeLessThan(100);
      expect(d.laneX).toBeGreaterThanOrEqual(15);
      expect(d.laneX).toBeLessThanOrEqual(85);
    });
    // Roughly increasing downfield so they don't all clump at the start.
    for (let i = 1; i < spawns.length; i++) {
      expect(spawns[i].yardLine).toBeGreaterThan(spawns[i - 1].yardLine - 1);
    }
  });
});
