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

export const APPLICATION_STATUS = {
  applied: "Applied",
  reviewing: "Under Review",
  interview_requested: "Interview Requested",
  interview_scheduled: "Interview Scheduled",
  offer_sent: "Offer Sent",
  accepted: "Accepted",
  declined: "Declined",
  closed: "Closed",
} as const;

export function formatSalary(min?: number | null, max?: number | null, currency = "USD"): string {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
  if (!min && !max) return "Compensation TBD";
  if (min && max) return `$${fmt(min)}–$${fmt(max)}`;
  return `$${fmt((min || max)!)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
