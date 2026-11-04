import { describe, expect, it } from "vitest";
import { hasMeaningfulPlayback } from "./video-view-eligibility";

describe("meaningful video playback", () => {
  it("does not count a video that was only opened or loaded", () => {
    expect(hasMeaningfulPlayback(0, 30)).toBe(false);
    expect(hasMeaningfulPlayback(1.9, 30)).toBe(false);
  });
  it("counts a normal video after two seconds", () => {
    expect(hasMeaningfulPlayback(2, 30)).toBe(true);
  });
  it("counts half of a very short video but not its first frame", () => {
    expect(hasMeaningfulPlayback(0.49, 1)).toBe(false);
    expect(hasMeaningfulPlayback(0.5, 1)).toBe(true);
  });
  it("ignores invalid playback positions", () => {
    expect(hasMeaningfulPlayback(Number.NaN, 15)).toBe(false);
    expect(hasMeaningfulPlayback(-5, 15)).toBe(false);
  });
});
