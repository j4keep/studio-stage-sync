export const JOB_CATEGORIES = [
  { id: "featured", label: "Featured", emoji: "🔥" },
  { id: "near-you", label: "Near You", emoji: "📍" },
  { id: "remote", label: "Remote", emoji: "💻" },
  { id: "students", label: "Students", emoji: "🎓" },
  { id: "trades", label: "Skilled Trades", emoji: "🛠" },
  { id: "creative", label: "Creative", emoji: "🎨" },
  { id: "corporate", label: "Corporate", emoji: "💼" },
  { id: "startups", label: "Startups", emoji: "🚀" },
  { id: "need-help", label: "Need Help Today", emoji: "🤝" },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
  { id: "temporary", label: "Temporary" },
  { id: "gig", label: "Gig" },
] as const;

export const REMOTE_MODES = [
  { id: "onsite", label: "On-site" },
  { id: "hybrid", label: "Hybrid" },
  { id: "remote", label: "Remote" },
] as const;

export const EXPERIENCE_LEVELS = [
  { id: "entry", label: "Entry" },
  { id: "mid", label: "Mid" },
  { id: "senior", label: "Senior" },
  { id: "executive", label: "Executive" },
] as const;

export const URGENCY_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "flexible", label: "Flexible" },
] as const;

export const QUALIFICATION_OPTIONS = [
  "Driver's License",
  "CDL License",
  "High School Diploma / GED",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Professional Certification",
  "Trade / Vocational Certificate",
  "State License (specify in description)",
  "Background Check",
  "Drug Test",
  "Reliable Transportation",
  "Legally Authorized to Work in the U.S.",
  "18 years or older",
  "21 years or older",
  "Bilingual",
  "First Aid / CPR",
  "OSHA Certified",
  "Food Handler's Card",
  "ServSafe Certified",
  "Notary",
  "Own Tools / Equipment",
] as const;

export const SHIFT_OPTIONS = [
  "Full-time",
  "Part-time",
  "Weekends",
  "Evenings",
  "Overnight",
  "Flexible",
] as const;

export const APPLICATION_STATUS = {
  reviewing: "Reviewing",
  interview: "Interview",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

/** Ordered progress phases (terminal outcomes excluded). */
export const APPLICATION_PHASE_FLOW = ["reviewing", "interview", "offered", "hired"] as const;

/** Map legacy "applied" rows to reviewing for display/pipeline. */
export function normalizeAppStatus(status: string): ApplicationStatus | string {
  if (status === "applied") return "reviewing";
  return status;
}

export function applicationStatusLabel(status: string): string {
  const key = normalizeAppStatus(status);
  return APPLICATION_STATUS[key as ApplicationStatus] ?? String(key);
}

export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatSalary(min?: number | string | null, max?: number | string | null, currency = "USD"): string {
  const a = parseMoney(min ?? null);
  const b = parseMoney(max ?? null);
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
  if (a == null && b == null) return "Compensation TBD";
  if (a != null && b != null) {
    if (a === b) return `$${fmt(a)}`;
    return `$${fmt(Math.min(a, b))}–$${fmt(Math.max(a, b))}`;
  }
  return `$${fmt((a ?? b)!)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Opens Google Maps search for a job address/location. */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/**
 * Normalize employer apply URLs so bare domains don't open as relative paths
 * (which 404 inside this app under HashRouter).
 */
export function normalizeExternalApplyUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  // Treat bare domains / paths as external https URLs, not in-app routes.
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value) || value.includes(".")) {
    return `https://${value}`;
  }
  return null;
}

export type Prefs = {
  titles?: string[] | null;
  categories?: string[] | null;
  locations?: string[] | null;
  employment_types?: string[] | null;
  experience_level?: string | null;
  salary_expect?: number | null;
  remote_ok?: boolean | null;
  hybrid_ok?: boolean | null;
  onsite_ok?: boolean | null;
  alert_keywords?: string[] | null;
};

/** Score a job/gig listing against a user's preferences (0-100). */
export function scoreListing(item: any, prefs: Prefs | null): number {
  if (!prefs) return 0;
  let score = 0;
  const title = (item.title || "").toLowerCase();
  const cat = (item.category || "").toLowerCase();
  const loc = (item.location || "").toLowerCase();
  const type = item.employment_type || "";
  const mode = item.remote_mode || "";

  (prefs.titles || []).forEach((t) => { if (t && title.includes(t.toLowerCase())) score += 25; });
  (prefs.alert_keywords || []).forEach((k) => { if (k && title.includes(k.toLowerCase())) score += 15; });
  (prefs.categories || []).forEach((c) => { if (c && cat.includes(c.toLowerCase())) score += 20; });
  (prefs.locations || []).forEach((l) => { if (l && loc.includes(l.toLowerCase())) score += 15; });
  if (prefs.employment_types?.includes(type)) score += 10;
  if (item.experience_level && prefs.experience_level === item.experience_level) score += 8;
  if (mode === "remote" && prefs.remote_ok) score += 12;
  if (mode === "hybrid" && prefs.hybrid_ok) score += 8;
  if (mode === "onsite" && prefs.onsite_ok) score += 6;
  if (prefs.salary_expect && item.salary_max && item.salary_max >= prefs.salary_expect) score += 10;
  return score;
}
