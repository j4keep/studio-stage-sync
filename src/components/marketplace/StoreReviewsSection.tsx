import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import StoreRatingStars from "@/components/marketplace/StoreRatingStars";
import {
  findRateableOrder,
  listStoreReviews,
  replyToStoreReview,
  storeRatingFromReviews,
  submitStoreReview,
  type RateableOrder,
  type StoreReview,
} from "@/lib/store-reviews";

type Props = {
  sellerId: string;
  listingId?: string | null;
  /** Hide the heading when the parent already shows one */
  compact?: boolean;
};

/**
 * $1–$5 store ratings and comments. Buyers may rate once the seller marks the
 * sale complete; the seller can reply to any comment.
 */
export default function StoreReviewsSection({ sellerId, listingId, compact }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateable, setRateable] = useState<RateableOrder | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const isSeller = !!user && user.id === sellerId;

  const load = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const rows = await listStoreReviews(sellerId);
      setReviews(rows);
      if (user && user.id !== sellerId) setRateable(await findRateableOrder(user.id, sellerId));
      else setRateable(null);
    } catch {
      /* reviews are non-critical */
    } finally {
      setLoading(false);
    }
  }, [sellerId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const rating = useMemo(() => storeRatingFromReviews(reviews), [reviews]);

  const send = async () => {
    if (!user || !rateable) return;
    setSaving(true);
    try {
      await submitStoreReview({
        cartId: rateable.cart_id,
        sellerId,
        buyerId: user.id,
        listingId: listingId || null,
        score,
        comment,
      });
      toast.success("Thanks — your rating is live on this store");
      setComment("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save your rating");
    } finally {
      setSaving(false);
    }
  };

  const reply = async (id: string) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await replyToStoreReview(id, replyText);
      setReplyFor(null);
      setReplyText("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not post your reply");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-5">
      {!compact && <h2 className="text-sm font-black">Store ratings & comments</h2>}
      <div className="mt-1.5">
        <StoreRatingStars rating={rating} size="md" />
      </div>

      {user && !isSeller && rateable && !rateable.reviewed && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <p className="text-[13px] font-bold">Rate this seller</p>
          <p className="text-[11.5px] text-muted-foreground">Your order is complete — how did it go?</p>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} stars`}>
                <Star className={`h-7 w-7 ${n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Leave a comment for other shoppers (optional)"
            className="mt-2 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void send()}
            className="mt-2 h-11 w-full rounded-full bg-primary text-sm font-black text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Post rating"}
          </button>
        </div>
      )}

      {user && !isSeller && !rateable && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          You can rate this seller after they mark your order complete.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">No comments yet — be the first to review this store.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {reviews.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                {r.buyer?.avatar_url ? (
                  <img src={r.buyer.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{r.buyer?.display_name || "Buyer"}</p>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3 w-3 ${n <= r.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                    <span className="ml-1 text-[10.5px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-wrap text-[13px]">{r.comment}</p>}

              {r.seller_reply && (
                <div className="mt-2 rounded-xl bg-muted/60 px-3 py-2">
                  <p className="text-[11px] font-black text-primary">Seller replied</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12.5px]">{r.seller_reply}</p>
                </div>
              )}

              {isSeller && !r.seller_reply && (
                <>
                  {replyFor === r.id ? (
                    <div className="mt-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        placeholder="Write a reply…"
                        className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none"
                      />
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void reply(r.id)}
                          className="h-9 flex-1 rounded-full bg-primary text-[12px] font-black text-primary-foreground disabled:opacity-50"
                        >
                          Post reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyFor(null)}
                          className="h-9 rounded-full bg-muted px-4 text-[12px] font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyFor(r.id);
                        setReplyText("");
                      }}
                      className="mt-2 text-[12px] font-black text-primary"
                    >
                      Reply
                    </button>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
