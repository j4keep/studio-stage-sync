import { useState } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { submitStoreReview } from "@/lib/store-reviews";

type Props = {
  cartId: string;
  sellerId: string;
  buyerId: string;
  sellerName: string;
  onClose: () => void;
  onRated?: () => void;
};

/** Buyer rates a $1–$5 store seller after the seller completes the sale. */
export default function RateStoreSellerSheet({ cartId, sellerId, buyerId, sellerName, onClose, onRated }: Props) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await submitStoreReview({ cartId, sellerId, buyerId, score, comment });
      toast.success("Thanks — your rating is live on their store");
      onRated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save your rating");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Rate {sellerName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Your rating and comment show on their $1–$5 store page. They can reply to you.
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
          rows={3}
          placeholder="Optional comment"
          className="mt-4 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="mt-3 h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Post rating"}
        </button>
      </div>
    </div>
  );
}
