import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { listLocalHelpReviews } from "@/lib/pro-profiles";
import { resolveDisplayRating } from "@/lib/ratings";

type ReviewRow = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater_id: string;
  context_type: string | null;
  display_name: string;
  avatar_url: string | null;
};

/** Ratings + comments people left after gigs — shown at the bottom of a profile. */
export default function UserReviewsSection({ userId, title = "Reviews" }: { userId: string; title?: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const rows = (await listLocalHelpReviews(userId)) as ReviewRow[];
      if (!alive) return;
      setReviews(rows);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length : null;
  const display = resolveDisplayRating(avg, reviews.length);

  return (
    <section className="px-4 mt-6 pb-8">
      <div className="flex items-end justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < Math.round(display.average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
              />
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums">{display.average.toFixed(1)}</span>
          <span className="text-[11px] text-muted-foreground">
            {display.isDefault ? "New on YAJ" : `(${display.count})`}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading reviews…</p>}
        {!loading && reviews.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No reviews yet — finish a gig and both sides can rate each other.
          </p>
        )}
        {reviews.map((r) => (
          <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold">
                    {(r.display_name || "?")[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{r.display_name}</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < r.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                    />
                  ))}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            {r.comment && <p className="mt-2 text-[13px] leading-snug text-foreground">{r.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
