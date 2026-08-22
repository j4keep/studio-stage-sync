import { describe, expect, it } from "vitest";
import { LEVELS, isLevelUnlocked, starsForScore } from "./sugar-rush-levels";

describe("sugar-rush-levels", () => {
  it("defines an ascending difficulty curve", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].targetScore).toBeGreaterThan(LEVELS[i - 1].targetScore);
    }
  });

  it("awards stars based on the score thresholds", () => {
    const lvl = LEVELS[0];
    expect(starsForScore(lvl, 0)).toBe(0);
    expect(starsForScore(lvl, lvl.starScores[0])).toBe(1);
    expect(starsForScore(lvl, lvl.starScores[1])).toBe(2);
    expect(starsForScore(lvl, lvl.starScores[2])).toBe(3);
  });

  it("level 1 is always unlocked", () => {
    expect(isLevelUnlocked({}, 1)).toBe(true);
  });

  it("a level unlocks once the previous one has any stars", () => {
    expect(isLevelUnlocked({}, 2)).toBe(false);
    expect(isLevelUnlocked({ 1: 1 }, 2)).toBe(true);
    expect(isLevelUnlocked({ 1: 0 }, 2)).toBe(false);
  });
});
