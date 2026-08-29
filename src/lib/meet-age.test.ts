import { describe, expect, it } from "vitest";
import { meetAgeGate } from "@/lib/meet";

describe("meetAgeGate", () => {
  it("requires a birth year", () => {
    expect(meetAgeGate(null).ok).toBe(false);
    expect(meetAgeGate(undefined).ok).toBe(false);
  });

  it("blocks under 18", () => {
    const year = new Date().getFullYear() - 16;
    const gate = meetAgeGate(year);
    expect(gate.ok).toBe(false);
    expect(gate.age).toBe(16);
  });

  it("allows 18+", () => {
    const year = new Date().getFullYear() - 22;
    const gate = meetAgeGate(year);
    expect(gate.ok).toBe(true);
    expect(gate.age).toBe(22);
  });
});
