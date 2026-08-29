import { describe, expect, it } from "vitest";
import {
  ageBandFromDob,
  ageFromDob,
  isDailySocialLimitReached,
  isWithinQuietHours,
  isSocialConsumptionPath,
} from "@/lib/safety-balance";

describe("safety-balance", () => {
  it("assigns age bands from DOB", () => {
    const now = new Date("2026-08-29T12:00:00");
    expect(ageBandFromDob("2012-01-01", now)).toBe("teen");
    expect(ageBandFromDob("2012-08-28", now)).toBe("teen");
    expect(ageBandFromDob("2005-01-01", now)).toBe("adult");
    expect(ageBandFromDob("2015-01-01", now)).toBe("under_13");
    expect(ageFromDob("2000-08-29", now)).toBe(26);
  });

  it("handles quiet hours wrapping midnight", () => {
    const policy = {
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00:00",
      quiet_hours_end: "06:00:00",
    };
    expect(isWithinQuietHours(policy, new Date("2026-08-29T23:00:00"))).toBe(true);
    expect(isWithinQuietHours(policy, new Date("2026-08-29T05:00:00"))).toBe(true);
    expect(isWithinQuietHours(policy, new Date("2026-08-29T12:00:00"))).toBe(false);
  });

  it("enforces daily social limits", () => {
    expect(
      isDailySocialLimitReached({
        daily_social_limit_minutes: 90,
        social_minutes_used_today: 90,
        social_usage_date: "2026-08-29",
      }, "2026-08-29"),
    ).toBe(true);
    expect(
      isDailySocialLimitReached({
        daily_social_limit_minutes: 90,
        social_minutes_used_today: 90,
        social_usage_date: "2026-08-28",
      }, "2026-08-29"),
    ).toBe(false);
  });

  it("treats feed as social and explore as utility hub", () => {
    expect(isSocialConsumptionPath("/")).toBe(true);
    expect(isSocialConsumptionPath("/feed")).toBe(true);
    expect(isSocialConsumptionPath("/battles")).toBe(true);
    expect(isSocialConsumptionPath("/explore")).toBe(false);
    expect(isSocialConsumptionPath("/marketplace")).toBe(false);
  });
});
