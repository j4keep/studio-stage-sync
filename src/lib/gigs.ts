export type GigStatus = "open" | "assigned" | "in_progress" | "completed" | "closed" | "cancelled";

export function gigStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "assigned":
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "closed":
    case "cancelled":
      return "Cancelled";
    default:
      return "Open";
  }
}

/** Helper user id — prefers live `assigned_to`, falls back to legacy `worker_id`. */
export function gigHelperId(gig: {
  assigned_to?: string | null;
  worker_id?: string | null;
}) {
  return gig.assigned_to || gig.worker_id || null;
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
