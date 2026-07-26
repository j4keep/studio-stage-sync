import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { expressGigInterest } from "@/lib/gig-interests";

type Props = {
  open: boolean;
  onClose: () => void;
  gigId: string;
  userId: string;
  gigTitle: string;
  initialBio?: string;
  onReadyToMessage: (bio: string) => void;
};

/** Collect a short experience bio before messaging the gig host. */
export default function GigInterestSheet({
  open,
  onClose,
  gigId,
  userId,
  gigTitle,
  initialBio = "",
  onReadyToMessage,
}: Props) {
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const trimmed = bio.trim();
    if (trimmed.length < 10) {
      toast.error("Add a short bio (at least 10 characters) about your experience");
      return;
    }
    setSaving(true);
    try {
      await expressGigInterest({ gigId, userId, experienceBio: trimmed });
      onReadyToMessage(trimmed);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save interest");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Interested in this gig?</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Tell the host why you&apos;re a fit for <span className="font-semibold text-foreground">{gigTitle}</span>. They
          choose who to approve — the gig stays open until then.
        </p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={280}
          placeholder="Short bio: skills, tools, past jobs like this…"
          className="mb-2 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="mb-3 text-right text-[10px] text-muted-foreground">{bio.trim().length}/280</p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue to message"}
        </button>
      </div>
    </div>
  );
}
