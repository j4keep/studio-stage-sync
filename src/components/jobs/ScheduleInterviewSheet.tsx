import { useState } from "react";
import { X, Video, Phone } from "lucide-react";
import {
  type InterviewCallKind,
  interviewRoomId,
  toLocalInputValue,
  fromLocalInputValue,
  withInterviewInvite,
  type JobInterviewInvite,
} from "@/lib/job-interview";

type Props = {
  open: boolean;
  applicantName: string;
  applicationId: string;
  existingRefs?: unknown;
  onClose: () => void;
  onScheduled: (payload: {
    status: "interview";
    applicant_accepted: boolean;
    references_json: Record<string, unknown>;
    invite: JobInterviewInvite;
  }) => void;
};

export default function ScheduleInterviewSheet({
  open,
  applicantName,
  applicationId,
  existingRefs,
  onClose,
  onScheduled,
}: Props) {
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  })();
  const defaultDeadline = (() => {
    const d = new Date(defaultStart);
    d.setMinutes(d.getMinutes() + 45);
    return d;
  })();

  const [atLocal, setAtLocal] = useState(toLocalInputValue(defaultStart));
  const [deadlineLocal, setDeadlineLocal] = useState(toLocalInputValue(defaultDeadline));
  const [callKind, setCallKind] = useState<InterviewCallKind>("video");
  const [externalUrl, setExternalUrl] = useState("");

  if (!open) return null;

  const submit = () => {
    const at = fromLocalInputValue(atLocal);
    const deadline = fromLocalInputValue(deadlineLocal);
    if (Number.isNaN(at.getTime()) || Number.isNaN(deadline.getTime())) return;
    if (deadline.getTime() <= at.getTime()) {
      // keep UI simple — nudge deadline after start
      deadline.setTime(at.getTime() + 45 * 60 * 1000);
    }
    const invite: JobInterviewInvite = {
      at: at.toISOString(),
      join_deadline: deadline.toISOString(),
      call_kind: callKind,
      room: interviewRoomId(applicationId),
      external_url: externalUrl.trim() || null,
      invited_at: new Date().toISOString(),
    };
    onScheduled({
      status: "interview",
      applicant_accepted: false,
      references_json: withInterviewInvite(existingRefs, invite),
      invite,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-3xl md:rounded-2xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Schedule interview</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">With {applicantName}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">Interview date & time *</span>
          <input
            type="datetime-local"
            value={atLocal}
            onChange={(e) => {
              setAtLocal(e.target.value);
              const start = fromLocalInputValue(e.target.value);
              if (!Number.isNaN(start.getTime())) {
                const d = new Date(start);
                d.setMinutes(d.getMinutes() + 45);
                setDeadlineLocal(toLocalInputValue(d));
              }
            }}
            className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">Join deadline *</span>
          <input
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Applicant must accept and join before this time.
          </p>
        </label>

        <div>
          <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Call type *</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCallKind("video")}
              className={`h-11 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                callKind === "video" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Video call
            </button>
            <button
              type="button"
              onClick={() => setCallKind("audio")}
              className={`h-11 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                callKind === "audio" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
              }`}
            >
              <Phone className="w-3.5 h-3.5" /> Audio call
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Opens a private YAJ interview channel. A join link is sent to the applicant’s My Jobs → Interviews.
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">External link (optional)</span>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Zoom / Google Meet / phone link"
            className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm"
        >
          Send interview invite
        </button>
      </div>
    </div>
  );
}
