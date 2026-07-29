import { useState } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  offerId: string;
  listingId: string;
  raterId: string;
  rateeId: string;
  rateeName: string;
  /** Rate them as seller or as buyer */
  rateeRole: "seller" | "buyer";
  onRated?: () => void;
};

/** Rate the other party after a marketplace offer is accepted. */
export default function RateMarketplaceSheet({
  open,
  onClose,
  offerId,
  listingId,
  raterId,
  rateeId,
  rateeName,
  rateeRole,
  onRated,
}: Props) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    const context_type = rateeRole === "seller" ? "marketplace_seller" : "marketplace_buyer";
    const { error } = await supabase.from("user_ratings").upsert(
      {
        rater_id: raterId,
        ratee_id: rateeId,
        context_type,
        context_id: offerId || listingId,
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
    toast.success("Thanks — rating saved on their Marketplace profile");
    onRated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Rate {rateeName}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          This {rateeRole} rating shows on their Marketplace profile so buyers and sellers stay accountable.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} stars`}>
              <Star className={`h-8 w-8 ${n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment"
          rows={3}
          className="mt-4 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="mt-3 h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Submit rating"}
        </button>
      </div>
    </div>
  );
}
