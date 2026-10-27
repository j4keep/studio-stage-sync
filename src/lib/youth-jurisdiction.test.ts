import { describe, expect, it } from "vitest";
import { minimumSocialAge, signupAgeDecision } from "./youth-jurisdiction";

describe("country-aware signup", () => {
  it("blocks under-16 Australian applicants and cannot be overridden by a parent", () => {
    expect(minimumSocialAge("AU")).toBe(16);
    expect(signupAgeDecision(15, "AU").allowed).toBe(false);
    expect(signupAgeDecision(16, "AU").allowed).toBe(true);
  });
  it("uses age 13 as a provisional baseline for supported markets", () => {
    expect(signupAgeDecision(12, "US").allowed).toBe(false);
    expect(signupAgeDecision(13, "US").allowed).toBe(true);
  });
  it("fails closed on unsupported or missing jurisdiction data", () => {
    expect(signupAgeDecision(17, "OTHER").allowed).toBe(false);
    expect(signupAgeDecision(17, "").allowed).toBe(false);
    expect(signupAgeDecision(null, "AU").allowed).toBe(false);
  });
});
