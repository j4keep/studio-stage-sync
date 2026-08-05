import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REASONS = [
  "Copyright issue",
  "Uploaded wrong file",
  "Harassment",
  "Privacy concern",
  "Other",
];

type Props = {
  open: boolean;
  onClose: () => void;
  reporterId: string;
  targetType: "battle" | "post" | "other";
  targetId: string;
  title?: string;
};

export default function ReportContentSheet({
  open,
  onClose,
  reporterId,
  targetType,
  targetId,
  title = "Request removal / report",
}: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    const { error: reportErr } = await (supabase as any).from("content_reports").insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
      status: "open",
    });

    // Also open a Customer Relations ticket so it shows in your admin inbox.
    const { error: ticketErr } = await (supabase as any).from("support_tickets").insert({
      user_id: reporterId,
      subject: `[${targetType}] ${reason}`.slice(0, 200),
      message: [
        `Remove / report request`,
        `Type: ${targetType}`,
        `ID: ${targetId}`,
        `Reason: ${reason}`,
        details.trim() ? `Details: ${details.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000),
      category: "content_report",
      status: "open",
    });

    setSaving(false);
    if (reportErr && ticketErr) {
      toast.error(reportErr.message || ticketErr.message || "Could not send report");
      return;
    }
    toast.success("Sent to Customer Relations — an admin will review it");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Once a battle is accepted, participants can’t erase it alone. Request removal for copyright,
          privacy, harassment, or a wrong upload — Customer Relations reviews it.
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
          placeholder="Add details for the review team…"
          className="mb-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Sending…" : "Submit to Customer Relations"}
        </button>
      </div>
    </div>
  );
}
