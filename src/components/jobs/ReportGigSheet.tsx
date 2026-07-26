import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REASONS = [
  "No-show / incomplete work",
  "Payment or budget dispute",
  "Harassment or unsafe behavior",
  "Scam or fraud",
  "Other",
];

type Props = {
  open: boolean;
  onClose: () => void;
  gigId: string;
  reporterId: string;
  reportedId: string;
};

export default function ReportGigSheet({ open, onClose, gigId, reporterId, reportedId }: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("gig_reports").insert({
      gig_id: gigId,
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      details: details.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report sent to YAJ — we'll review it");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Report an issue to YAJ</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          File a complaint if something went wrong on this gig. YAJ support will review it.
        </p>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Describe what happened…"
          className="mb-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Sending…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
