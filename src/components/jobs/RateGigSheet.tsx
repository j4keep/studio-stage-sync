import { useState } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  gigId: string;
  raterId: string;
  rateeId: string;
  rateeName: string;
  onRated?: () => void;
};

export default function RateGigSheet({ open, onClose, gigId, raterId, rateeId, rateeName, onRated }: Props) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("user_ratings").upsert(
      {
        rater_id: raterId,
        ratee_id: rateeId,
        context_type: "gig",
        context_id: gigId,
        score,
        comment: comment.trim() || null,
      },
      { onConflict: "ratee_id,rater_id,context_type,context_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Rated ${rateeName}`);
    onRated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Rate {rateeName}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">How was working with them on this gig?</p>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setScore(n)} className="p-1" aria-label={`${n} stars`}>
              <Star className={`h-8 w-8 ${n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Optional comment"
          className="mb-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Submit rating"}
        </button>
      </div>
    </div>
  );
}
