import type { EngineerBookingProfile } from "./bookingTypes";
import { DEFAULT_ENGINEER_PROFILE } from "./bookingTypes";
import { loadEngineerProfile, saveEngineerProfile } from "./engineerProfileStorage";

const PREFIX = "wstudio_session_rates_v1_";

export function sessionRatesKey(sessionId: string): string {
  return `${PREFIX}${sessionId.trim()}`;
}

/** Rates the artist sees for this session (engineer should publish via join screen). */
export function loadSessionRates(sessionId: string): EngineerBookingProfile {
  if (!sessionId.trim()) return { ...DEFAULT_ENGINEER_PROFILE };
  try {
    const raw = localStorage.getItem(sessionRatesKey(sessionId));
    if (!raw) return { ...DEFAULT_ENGINEER_PROFILE };
    const parsed = JSON.parse(raw) as Partial<EngineerBookingProfile>;
    return {
      ...DEFAULT_ENGINEER_PROFILE,
      ...parsed,
      hourlyRate: Number(parsed.hourlyRate ?? DEFAULT_ENGINEER_PROFILE.hourlyRate),
      minimumBookingMinutes: Number(
        parsed.minimumBookingMinutes ?? DEFAULT_ENGINEER_PROFILE.minimumBookingMinutes,
      ),
      maxExtensionMinutes: Number(
        parsed.maxExtensionMinutes ?? DEFAULT_ENGINEER_PROFILE.maxExtensionMinutes,
      ),
      overtimeHourlyRate: Number(
        parsed.overtimeHourlyRate ?? DEFAULT_ENGINEER_PROFILE.overtimeHourlyRate,
      ),
      extensionsEnabled:
        parsed.extensionsEnabled ?? DEFAULT_ENGINEER_PROFILE.extensionsEnabled,
    };
  } catch {
    return { ...DEFAULT_ENGINEER_PROFILE };
  }
}

export function saveSessionRates(sessionId: string, profile: EngineerBookingProfile): void {
  try {
    localStorage.setItem(sessionRatesKey(sessionId), JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

/** Copy logged-in engineer defaults onto this session ID for the artist booking flow. */
export function publishEngineerRatesToSession(sessionId: string, userId: string | undefined): void {
  const profile = loadEngineerProfile(userId);
  saveSessionRates(sessionId.trim(), profile);
}

/** Optional: keep session rates in sync when engineer edits profile (advanced). */
export function persistEngineerProfileAndSession(
  sessionId: string,
  userId: string,
  profile: EngineerBookingProfile,
): void {
  saveEngineerProfile(userId, profile);
  saveSessionRates(sessionId.trim(), profile);
}
