import { describe, expect, it } from "vitest";
import { formatAuthError, isAuthNetworkError } from "./auth-errors";

describe("auth-errors", () => {
  it("detects Safari Load failed as a network error", () => {
    expect(isAuthNetworkError("Load failed")).toBe(true);
    expect(isAuthNetworkError("Failed to fetch")).toBe(true);
    expect(isAuthNetworkError("Invalid login credentials")).toBe(false);
  });

  it("formats network login errors with actionable copy", () => {
    const formatted = formatAuthError("Load failed", "login");
    expect(formatted.title).toBe("Can't reach YAJ servers");
    expect(formatted.description).toMatch(/Cloud\/Supabase/i);
  });
});
