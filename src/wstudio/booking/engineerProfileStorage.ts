import type { EngineerBookingProfile } from "./bookingTypes";
import { DEFAULT_ENGINEER_PROFILE } from "./bookingTypes";

const PREFIX = "wstudio_engineer_booking_v1_";

function key(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function loadEngineerProfile(userId: string | undefined): EngineerBookingProfile {
  if (!userId) return { ...DEFAULT_ENGINEER_PROFILE };
  try {
    const raw = localStorage.getItem(key(userId));
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

export function saveEngineerProfile(userId: string, profile: EngineerBookingProfile): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}
