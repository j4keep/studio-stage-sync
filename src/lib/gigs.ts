export type GigStatus = "open" | "in_progress" | "completed" | "closed";

export function gigStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

export function bothPartiesCompleted(gig: {
  poster_completed_at?: string | null;
  worker_completed_at?: string | null;
}) {
  return Boolean(gig.poster_completed_at && gig.worker_completed_at);
}

export function canRateGig(gig: {
  status?: string | null;
  poster_completed_at?: string | null;
  worker_completed_at?: string | null;
}) {
  return gig.status === "completed" || bothPartiesCompleted(gig);
}

export function formatGigBudget(min?: number | null, max?: number | null) {
  if (min == null && max == null) return "Open budget";
  if (min != null && max != null) return `$${min}–$${max}`;
  if (min != null) return `From $${min}`;
  return `Up to $${max}`;
}
