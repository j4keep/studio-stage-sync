import { describe, expect, it } from "vitest";
import { measureFromPhoto } from "./photo-measurement";

describe("calibrated photo measuring", () => {
  it("measures a distance relative to an explicit known reference", () => {
    const result = measureFromPhoto([
      { x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 }, // reference 12 inches
      { x: 0.1, y: 0.6 }, { x: 0.5, y: 0.6 }, // target twice as long
    ], 12);
    expect(result?.measuredLength).toBe(24);
  });
  it("rejects uncalibrated, invalid or zero-length markings", () => {
    expect(measureFromPhoto([], 12)).toBeNull();
    expect(measureFromPhoto([{x:0,y:0},{x:0,y:0},{x:.1,y:.1},{x:.5,y:.5}],12)).toBeNull();
    expect(measureFromPhoto([{x:0,y:0},{x:.2,y:0},{x:.1,y:.1},{x:.5,y:.5}],0)).toBeNull();
    expect(measureFromPhoto([{x:-1,y:0},{x:.2,y:0},{x:.1,y:.1},{x:.5,y:.5}],12)).toBeNull();
  });
});
