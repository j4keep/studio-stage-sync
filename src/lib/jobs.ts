import { supabase } from "@/integrations/supabase/client";

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

/** Per-job cover image stored in job_listings.media (works without cover_image_url column). */
export function jobCoverFromMedia(media: unknown): string | null {
  if (!media) return null;
  if (typeof media === "string" && media.startsWith("http")) return media;
  if (Array.isArray(media)) {
    for (const item of media) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.url === "string" && row.url) return row.url;
      if (typeof row.cover_image_url === "string" && row.cover_image_url) return row.cover_image_url;
    }
    return null;
  }
  if (typeof media === "object") {
    const row = media as Record<string, unknown>;
    if (typeof row.url === "string" && row.url) return row.url;
    if (typeof row.cover_image_url === "string" && row.cover_image_url) return row.cover_image_url;
  }
  return null;
}

export function jobCoverMedia(url: string | null | undefined) {
  if (!url) return [];
  return [{ kind: "cover", url }];
}

export function resolveJobCover(job: { cover_image_url?: string | null; media?: unknown } | null | undefined): string | null {
  if (!job) return null;
  if (job.cover_image_url) return job.cover_image_url;
  return jobCoverFromMedia(job.media);
}

/** Notify applicant after employer status/interview update (edge function + optional RPC). */
export async function notifyJobApplicant(applicationId: string): Promise<{ ok: boolean; error?: string }> {
  // Prefer edge function (service role insert) — works even before SQL trigger migrations apply
  const { data, error: fnError } = await supabase.functions.invoke("notify-job-applicant", {
    body: { application_id: applicationId },
  });
  if (!fnError && data && (data as { ok?: boolean }).ok) {
    return { ok: true };
  }

  const { error } = await (supabase as any).rpc("notify_job_applicant", {
    p_application_id: applicationId,
  });
  if (!error) return { ok: true };

  const msg = fnError?.message || error.message;
  if (/could not find|does not exist|404|Failed to send/i.test(msg)) {
    return { ok: false, error: msg };
  }
  return { ok: false, error: msg };
}
