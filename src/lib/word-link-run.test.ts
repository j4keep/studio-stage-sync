import { describe, expect, it } from "vitest";
import {
  ALL_FOUND_BONUS,
  PUZZLES,
  RoundResult,
  WordLinkState,
  applyRoundResult,
  initialWordLink,
  maxPossiblePoints,
  scoreWord,
  shufflePuzzles,
} from "./word-link-run";

/** True if `word` can be spelled using no more of any letter than `letters` contains. */
function isFormable(word: string, letters: string): boolean {
  const pool: Record<string, number> = {};
  for (const ch of letters) pool[ch] = (pool[ch] || 0) + 1;
  for (const ch of word) {
    if (!pool[ch]) return false;
    pool[ch] -= 1;
  }
  return true;
}

function round(partial: Partial<RoundResult>): RoundResult {
  return { points: 0, wordsFound: 0, totalWords: 0, ...partial };
}

describe("word-link-run — puzzle data integrity", () => {
  it("every puzzle has at least 10 accepted words, all uppercase and 3+ letters", () => {
    PUZZLES.forEach((p) => {
      expect(p.words.length).toBeGreaterThanOrEqual(10);
      p.words.forEach((w) => {
        expect(w).toBe(w.toUpperCase());
        expect(w.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  it("every accepted word is actually formable from its puzzle's letters", () => {
    PUZZLES.forEach((p) => {
      p.words.forEach((w) => {
        expect(isFormable(w, p.letters)).toBe(true);
      });
    });
  });

  it("no puzzle repeats the same word twice", () => {
    PUZZLES.forEach((p) => {
      expect(new Set(p.words).size).toBe(p.words.length);
    });
  });

  it("shufflePuzzles returns every puzzle exactly once, in some order", () => {
    const shuffled = shufflePuzzles(() => 0.37);
    expect(shuffled).toHaveLength(PUZZLES.length);
    expect(new Set(shuffled.map((p) => p.letters)).size).toBe(PUZZLES.length);
  });
});

describe("word-link-run — scoring", () => {
  it("a word's points equal its length", () => {
    expect(scoreWord("CAT")).toBe(3);
    expect(scoreWord("PLANET")).toBe(6);
  });

  it("a puzzle's max possible points is the sum of every word's length plus the bonus", () => {
    const puzzle = { letters: "CAT", words: ["CAT", "ACT"] };
    expect(maxPossiblePoints(puzzle)).toBe(3 + 3 + ALL_FOUND_BONUS);
  });
});

describe("word-link-run — round flow", () => {
  it("starts with seat 0 up first, no rounds played, active", () => {
    const s = initialWordLink();
    expect(s.possession).toBe(0);
    expect(s.roundsPlayed).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a finished round credits the acting seat and hands the next round to the other seat", () => {
    const s = initialWordLink();
    const next = applyRoundResult(s, 0, round({ points: 45, wordsFound: 12, totalWords: 19 }));
    expect(next.scores[0]).toBe(45);
    expect(next.roundsPlayed[0]).toBe(1);
    expect(next.wordsFound[0]).toBe(12);
    expect(next.possession).toBe(1);
    expect(next.phase).toBe("active");
  });

  it("ends the match once both sides have used all their rounds, higher score wins", () => {
    let s: WordLinkState = { ...initialWordLink(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 50 }));
    expect(s.phase).toBe("active");
    s = applyRoundResult(s, 1, round({ points: 30 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(0);
  });

  it("a tied final score is a draw", () => {
    let s: WordLinkState = { ...initialWordLink(), maxRounds: 1 };
    s = applyRoundResult(s, 0, round({ points: 40 }));
    s = applyRoundResult(s, 1, round({ points: 40 }));
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBeNull();
  });
});
