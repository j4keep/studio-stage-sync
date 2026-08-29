/**
 * YAJ Safety & Balance — central account safety policy.
 * Feed, Explore, Circles, Games, Dating, Messaging, and notifications
 * should read from this module rather than inventing local toggles.
 */

export type AgeBand = "under_13" | "teen" | "adult" | "unknown";
export type ProfilePrivacy = "public" | "private";
export type DmPermission = "everyone" | "friends" | "friends_and_approved" | "none";
export type LocationPermission = "off" | "approximate" | "precise";

export type AccountSafetyPolicy = {
  user_id: string;
  date_of_birth: string | null;
  age_band: AgeBand;
  youth_mode: boolean;
  youth_welcome_seen_at: string | null;
  daily_social_limit_minutes: number | null;
  social_minutes_used_today: number;
  social_usage_date: string | null;
  continuous_reminder_minutes: number | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null; // "HH:MM:SS" or "HH:MM"
  quiet_hours_end: string | null;
  parent_account_id: string | null;
  parent_link_code: string | null;
  parent_link_code_expires_at: string | null;
  profile_privacy: ProfilePrivacy;
  dm_permission: DmPermission;
  location_permission: LocationPermission;
  detox_until: string | null;
  games_daily_limit_minutes: number | null;
  dating_allowed: boolean;
  created_at?: string;
  updated_at?: string;
};

export const TEEN_DEFAULT_DAILY_LIMIT_MINUTES = 90;
export const TEEN_DEFAULT_REMINDER_MINUTES = 45;
export const TEEN_DEFAULT_QUIET_START = "22:00";
export const TEEN_DEFAULT_QUIET_END = "06:00";

export const ADULT_LIMIT_PRESETS = [null, 30, 60, 120] as const;
export const REMINDER_PRESETS = [null, 30, 45, 60] as const;

/** Local calendar date YYYY-MM-DD */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ageFromDob(dob: string | Date, now = new Date()): number | null {
  const birth = typeof dob === "string" ? new Date(dob.includes("T") ? dob : `${dob}T12:00:00`) : dob;
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function ageBandFromDob(dob: string | null | undefined, now = new Date()): AgeBand {
  if (!dob) return "unknown";
  const age = ageFromDob(dob, now);
  if (age == null) return "unknown";
  if (age < 13) return "under_13";
  if (age < 18) return "teen";
  return "adult";
}

export function youthDefaults(userId: string, dob: string): AccountSafetyPolicy {
  return {
    user_id: userId,
    date_of_birth: dob,
    age_band: "teen",
    youth_mode: true,
    youth_welcome_seen_at: null,
    daily_social_limit_minutes: TEEN_DEFAULT_DAILY_LIMIT_MINUTES,
    social_minutes_used_today: 0,
    social_usage_date: localDateString(),
    continuous_reminder_minutes: TEEN_DEFAULT_REMINDER_MINUTES,
    quiet_hours_enabled: true,
    quiet_hours_start: `${TEEN_DEFAULT_QUIET_START}:00`,
    quiet_hours_end: `${TEEN_DEFAULT_QUIET_END}:00`,
    parent_account_id: null,
    parent_link_code: null,
    parent_link_code_expires_at: null,
    profile_privacy: "private",
    dm_permission: "friends_and_approved",
    location_permission: "off",
    detox_until: null,
    games_daily_limit_minutes: 60,
    dating_allowed: false,
  };
}

export function adultDefaults(userId: string, dob: string | null): AccountSafetyPolicy {
  return {
    user_id: userId,
    date_of_birth: dob,
    age_band: dob ? "adult" : "unknown",
    youth_mode: false,
    youth_welcome_seen_at: null,
    daily_social_limit_minutes: null,
    social_minutes_used_today: 0,
    social_usage_date: localDateString(),
    continuous_reminder_minutes: null,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    parent_account_id: null,
    parent_link_code: null,
    parent_link_code_expires_at: null,
    profile_privacy: "public",
    dm_permission: "everyone",
    location_permission: "off",
    detox_until: null,
    games_daily_limit_minutes: null,
    dating_allowed: true,
  };
}

export function policyForDob(userId: string, dob: string): AccountSafetyPolicy {
  const band = ageBandFromDob(dob);
  if (band === "teen") return youthDefaults(userId, dob);
  if (band === "adult") return adultDefaults(userId, dob);
  return {
    ...adultDefaults(userId, dob),
    age_band: band,
    youth_mode: false,
    dating_allowed: false,
  };
}

/** Parse "HH:MM" or "HH:MM:SS" to minutes from midnight */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":").map((x) => Number(x));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return parts[0] * 60 + parts[1];
}

/** Quiet hours may wrap midnight (e.g. 22:00–06:00). */
export function isWithinQuietHours(
  policy: Pick<AccountSafetyPolicy, "quiet_hours_enabled" | "quiet_hours_start" | "quiet_hours_end">,
  now = new Date(),
): boolean {
  if (!policy.quiet_hours_enabled) return false;
  const start = timeToMinutes(policy.quiet_hours_start);
  const end = timeToMinutes(policy.quiet_hours_end);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

export function formatQuietResumeLabel(
  quietEnd: string | null | undefined,
): string {
  const mins = timeToMinutes(quietEnd);
  if (mins == null) return "later";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function isDetoxActive(policy: Pick<AccountSafetyPolicy, "detox_until">, now = new Date()): boolean {
  if (!policy.detox_until) return false;
  return new Date(policy.detox_until).getTime() > now.getTime();
}

export function effectiveSocialMinutesUsed(
  policy: Pick<AccountSafetyPolicy, "social_minutes_used_today" | "social_usage_date">,
  today = localDateString(),
): number {
  if (policy.social_usage_date !== today) return 0;
  return policy.social_minutes_used_today || 0;
}

export function isDailySocialLimitReached(
  policy: Pick<
    AccountSafetyPolicy,
    "daily_social_limit_minutes" | "social_minutes_used_today" | "social_usage_date"
  >,
  today = localDateString(),
): boolean {
  const limit = policy.daily_social_limit_minutes;
  if (limit == null || limit <= 0) return false;
  return effectiveSocialMinutesUsed(policy, today) >= limit;
}

/**
 * Consumption-heavy social paths (count toward daily limit / quiet / detox).
 * Utility surfaces (marketplace, jobs, bookings, settings, help) are excluded.
 */
export function isSocialConsumptionPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/feed") return true;
  if (pathname === "/battles" || pathname.startsWith("/battle/")) return true;
  if (pathname.startsWith("/artist/")) return true;
  if (pathname === "/circle" || pathname.startsWith("/circle/c/")) {
    if (pathname.endsWith("/settings")) return false;
    return true;
  }
  if (pathname.startsWith("/live/")) return true;
  if (pathname.startsWith("/games")) return true;
  // /explore stays available as the utility hub (Marketplace, Jobs, Local Help, etc.)
  return false;
}

/** Paths always allowed when social areas are locked */
export function isUtilityAllowedDuringSocialLock(pathname: string): boolean {
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/safety")) return true;
  if (pathname.startsWith("/help")) return true;
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/messages")) return true;
  if (pathname.startsWith("/marketplace")) return true;
  if (pathname.startsWith("/local-help")) return true;
  if (pathname.startsWith("/jobs") || pathname.startsWith("/my-jobs") || pathname.startsWith("/my-gigs")) return true;
  if (pathname.startsWith("/my-bookings") || pathname.startsWith("/my-studios")) return true;
  if (pathname.startsWith("/purchases") || pathname.startsWith("/earnings")) return true;
  if (pathname === "/terms" || pathname === "/community-timeout") return true;
  if (pathname.startsWith("/ask-yaj")) return true;
  if (pathname.startsWith("/wellness")) return true;
  if (pathname.startsWith("/deals")) return true;
  if (pathname === "/radio" || pathname.startsWith("/library") || pathname.startsWith("/playlists")) return true;
  return false;
}

export type SocialLockReason = "quiet_hours" | "daily_limit" | "detox" | null;

export function getSocialLockReason(
  policy: AccountSafetyPolicy | null | undefined,
  now = new Date(),
): SocialLockReason {
  if (!policy) return null;
  if (isDetoxActive(policy, now)) return "detox";
  if (isWithinQuietHours(policy, now)) return "quiet_hours";
  if (isDailySocialLimitReached(policy, localDateString(now))) return "daily_limit";
  return null;
}

export function shouldBlockSocialPath(
  pathname: string,
  policy: AccountSafetyPolicy | null | undefined,
  now = new Date(),
): SocialLockReason {
  if (!isSocialConsumptionPath(pathname)) return null;
  if (isUtilityAllowedDuringSocialLock(pathname)) return null;
  return getSocialLockReason(policy, now);
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.floor(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h === 1 ? "1 hr" : `${h} hr`;
  return `${h} hr ${rem} min`;
}

export function generateParentLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function minutesUntil(dateIso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - now.getTime()) / 60000));
}

export function detoxUntilFromChoice(
  choice: "tomorrow" | "3d" | "7d" | "custom",
  customDays?: number,
  now = new Date(),
): Date {
  const d = new Date(now);
  if (choice === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
    return d;
  }
  const days = choice === "3d" ? 3 : choice === "7d" ? 7 : Math.max(1, customDays || 1);
  d.setDate(d.getDate() + days);
  return d;
}

/** Map DB row (times may be "22:00:00") into policy */
export function normalizePolicyRow(row: Record<string, unknown>, userId: string): AccountSafetyPolicy {
  const base = adultDefaults(userId, (row.date_of_birth as string) || null);
  return {
    ...base,
    ...row,
    user_id: (row.user_id as string) || userId,
    age_band: (row.age_band as AgeBand) || base.age_band,
    youth_mode: Boolean(row.youth_mode),
    social_minutes_used_today: Number(row.social_minutes_used_today) || 0,
    quiet_hours_enabled: Boolean(row.quiet_hours_enabled),
    dating_allowed: row.dating_allowed !== false && row.age_band !== "teen" && row.age_band !== "under_13",
    profile_privacy: (row.profile_privacy as ProfilePrivacy) || base.profile_privacy,
    dm_permission: (row.dm_permission as DmPermission) || base.dm_permission,
    location_permission: (row.location_permission as LocationPermission) || "off",
  } as AccountSafetyPolicy;
}
