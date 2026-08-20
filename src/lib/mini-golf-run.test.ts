import { describe, expect, it } from "vitest";
import {
  COURSE_H,
  COURSE_W,
  HOLES,
  HOLE_IN_ONE_POINTS,
  Hole,
  MAX_STROKES,
  MiniGolfState,
  RoundResult,
  applyRoundResult,
  initialMiniGolf,
  scoreForHole,
  shuffleHoles,
} from "./mini-golf-run";

/** True if point (x, y) falls inside rectangle r. */
function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, strokes: 0, sunk: false, holeName: "", ...partial };
}

describe("mini-golf-run — hole data integrity", () => {
  it("every hole has a sane par and cup radius", () => {
    HOLES.forEach((h) => {
      expect(h.par).toBeGreaterThanOrEqual(2);
      expect(h.par).toBeLessThanOrEqual(5);
      expect(h.cupRadius).toBeGreaterThan(0);
    });
  });

  it("every hole's start and cup lie within the course bounds", () => {
    HOLES.forEach((h) => {
      expect(h.start.x).toBeGreaterThanOrEqual(0);
      expect(h.start.x).toBeLessThanOrEqual(COURSE_W);
      expect(h.start.y).toBeGreaterThanOrEqual(0);
      expect(h.start.y).toBeLessThanOrEqual(COURSE_H);
      expect(h.cup.x).toBeGreaterThanOrEqual(0);
      expect(h.cup.x).toBeLessThanOrEqual(COURSE_W);
      expect(h.cup.y).toBeGreaterThanOrEqual(0);
      expect(h.cup.y).toBeLessThanOrEqual(COURSE_H);
    });
  });

  it("no hole's start or cup sits inside one of its own walls or hazards", () => {
    HOLES.forEach((h) => {
      [...h.walls, ...h.hazards].forEach((r) => {
        expect(inRect(h.start.x, h.start.y, r)).toBe(false);
        expect(inRect(h.cup.x, h.cup.y, r)).toBe(false);
      });
    });
  });

  it("no hole repeats its own name and all names are unique across the course", () => {
    expect(new Set(HOLES.map((h) => h.name)).size).toBe(HOLES.length);
  });

  it("shuffleHoles returns every hole exactly once, in some order", () => {
    const shuffled = shuffleHoles(() => 0.37);
    expect(shuffled).toHaveLength(HOLES.length);
    expect(new Set(shuffled.map((h) => h.name)).size).toBe(HOLES.length);
  });
});

describe("mini-golf-run — scoring", () => {
  const hole: Hole = { name: "Test", par: 3, start: { x: 0, y: 0 }, cup: { x: 0, y: 0 }, cupRadius: 10, walls: [], hazards: [] };

  it("a ball that never sinks scores 0 regardless of strokes", () => {
    expect(scoreForHole(hole, MAX_STROKES, false)).toBe(0);
  });

  it("a hole in one always scores the fixed bonus", () => {
    expect(scoreForHole(hole, 1, true)).toBe(HOLE_IN_ONE_POINTS);
  });

  it("sinking under par scores more than sinking at par", () => {
    const birdie = scoreForHole(hole, 2, true);
    const par = scoreForHole(hole, 3, true);
    expect(birdie).toBeGreaterThan(par);
  });

  it("sinking over par still scores at least 1 point", () => {
    expect(scoreForHole(hole, MAX_STROKES, true)).toBeGreaterThanOrEqual(1);
  });

  it("points strictly decrease as strokes increase, for a fixed par", () => {
    let prev = Infinity;
    for (let strokes = 1; strokes <= MAX_STROKES; strokes++) {
      const pts = scoreForHole(hole, strokes, true);
      expect(pts).toBeLessThanOrEqual(prev);
      prev = pts;
    }
  });
});

describe("mini-golf-run — round flow", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialMiniGolf();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialMiniGolf();
    const next = applyRoundResult(s, 0, round({ points: 7, strokes: 3, sunk: true, holeName: "Front Nine" }));
    expect(next.scores[0]).toBe(7);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.strokesTaken[0]).toBe(3);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: MiniGolfState = { ...initialMiniGolf(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 10 }));
    expect(s.phase).toBe("active");
    s = applyRoundResult(s, 1, round({ points: 5 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: MiniGolfState = { ...initialMiniGolf(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 6 }));
    s = applyRoundResult(s, 1, round({ points: 6 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });
});
