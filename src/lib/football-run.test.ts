import { describe, expect, it } from "vitest";
import { DriveResult, FootballRunState, applyDriveResult, initialFootballRun, scoreDrive } from "./football-run";

function drive(partial: Partial<DriveResult>): DriveResult {
  return { yards: 0, dodges: 0, touchdown: false, score: 0, outcome: "tackled", playType: "run", ...partial };
}

describe("football-run", () => {
  it("starts with seat 0 up first, no drives played, active", () => {
    const s = initialFootballRun();
    expect(s.possession).toBe(0);
    expect(s.drivesPlayed).toEqual([0, 0]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.touchdowns).toEqual([0, 0]);
    expect(s.totalYards).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("scores a drive from yards, dodges, and a touchdown bonus", () => {
    expect(scoreDrive(40, 2, false)).toBe(140);
    expect(scoreDrive(100, 3, true)).toBe(750);
    expect(scoreDrive(-5, 0, false)).toBe(0);
  });

  it("a finished drive credits the acting seat and hands the next drive to the other seat", () => {
    const s = initialFootballRun();
    const next = applyDriveResult(s, 0, drive({ yards: 30, dodges: 1, score: 80, outcome: "tackled" }));
    expect(next.scores[0]).toBe(80);
    expect(next.drivesPlayed[0]).toBe(1);
    expect(next.totalYards[0]).toBe(30);
    expect(next.totalDodges[0]).toBe(1);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
    expect(next.lastDrive?.seat).toBe(0);
  });

  it("tracks touchdown counts separately from score", () => {
    const s = initialFootballRun();
    const next = applyDriveResult(s, 1, drive({ yards: 100, touchdown: true, score: 600, outcome: "touchdown", playType: "pass" }));
    expect(next.touchdowns[1]).toBe(1);
    expect(next.touchdowns[0]).toBe(0);
  });

  it("ends the game once both sides have used all their drives, higher score wins", () => {
    let s: FootballRunState = { ...initialFootballRun(), maxDrives: 1 };
    s = applyDriveResult(s, 0, drive({ yards: 100, touchdown: true, score: 600, outcome: "touchdown" }));
    expect(s.phase).toBe("active"); // seat 1 still owes a drive
    s = applyDriveResult(s, 1, drive({ yards: 10, score: 10, outcome: "tackled" }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: FootballRunState = { ...initialFootballRun(), maxDrives: 1 };
    s = applyDriveResult(s, 0, drive({ yards: 20, score: 20 }));
    s = applyDriveResult(s, 1, drive({ yards: 20, score: 20 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });
});
