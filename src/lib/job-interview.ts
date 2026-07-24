/** Interview invite stored on job_applications.references_json.yaj_interview (no new columns required). */

export type InterviewCallKind = "video" | "audio";

export type JobInterviewInvite = {
  at: string; // ISO datetime for interview start
  join_deadline: string; // ISO — must join by this time
  call_kind: InterviewCallKind;
  room: string; // LiveKit room id
  external_url?: string | null; // optional Zoom/Meet/etc.
  invited_at?: string;
};

export function interviewRoomId(applicationId: string): string {
  return `job-interview-${applicationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

export function getInterviewInvite(app: { references_json?: unknown } | null | undefined): JobInterviewInvite | null {
  const ref = app?.references_json;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return null;
  const invite = (ref as Record<string, unknown>).yaj_interview;
  if (!invite || typeof invite !== "object") return null;
  const i = invite as Partial<JobInterviewInvite>;
  if (!i.at || !i.join_deadline || !i.room || !i.call_kind) return null;
  return {
    at: String(i.at),
    join_deadline: String(i.join_deadline),
    call_kind: i.call_kind === "audio" ? "audio" : "video",
    room: String(i.room),
    external_url: i.external_url ? String(i.external_url) : null,
    invited_at: i.invited_at ? String(i.invited_at) : undefined,
  };
}

export function withInterviewInvite(existing: unknown, invite: JobInterviewInvite): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, yaj_interview: invite };
}

export function formatInterviewWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export type InterviewJoinState = "pending_accept" | "open" | "expired" | "missing";

export function interviewJoinState(opts: {
  invite: JobInterviewInvite | null;
  applicantAccepted: boolean;
  isEmployer?: boolean;
  now?: Date;
}): InterviewJoinState {
  const { invite, applicantAccepted, isEmployer } = opts;
  const now = opts.now ?? new Date();
  if (!invite) return "missing";
  const deadline = new Date(invite.join_deadline).getTime();
  if (Number.isNaN(deadline) || now.getTime() > deadline) return "expired";
  // Employer can start the meeting any time before the join deadline
  if (isEmployer) return "open";
  if (!applicantAccepted) return "pending_accept";
  // After accept, applicant can join until the deadline (no waiting for scheduled clock)
  return "open";
}

/** datetime-local value from Date */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(v: string): Date {
  return new Date(v);
}
