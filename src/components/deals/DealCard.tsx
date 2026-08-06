import { useEffect, useState } from "react";
import { Bookmark, Clock, MapPin, Share2, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  formatDistance,
  isEndingSoon,
  remainingClaims,
  statusBadges,
} from "@/lib/deals";
import { dealCoverUrl, type Deal } from "@/lib/deals-api";
import { useCountdownLabel } from "@/hooks/use-countdown-label";
import VerifiedBusinessBadge from "@/components/deals/VerifiedBusinessBadge";

type Props = {
  deal: Deal;
  onSave?: (deal: Deal) => void;
  onShare?: (deal: Deal) => void;
};

function Stars({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function ClaimCount({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setN(0);
      return;
    }
    let frame = 0;
    const steps = 18;
    const id = window.setInterval(() => {
      frame += 1;
      setN(Math.round((value * frame) / steps));
      if (frame >= steps) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [value]);
  if (value <= 0) return null;
  return <span>Claimed {n.toLocaleString()} times</span>;
}

export default function DealCard({ deal, onSave, onShare }: Props) {
  const nav = useNavigate();
  const cover = dealCoverUrl(deal);
  const badges = statusBadges(deal);
  const remaining = remainingClaims(deal);
  const biz = deal.deal_businesses;
  const redeemable = !badges.includes("Expired") && !badges.includes("Sold Out");
  const ending = isEndingSoon(deal.expires_at);
  const rating = Number(biz?.avg_rating || 0);
  const reviewCount = Number(biz?.review_count || 0);
  const countdown = useCountdownLabel(deal.expires_at);

  return (
    <article className="deal-card group relative overflow-hidden rounded-[1.35rem] bg-card shadow-[0_10px_28px_-16px_rgba(15,23,42,0.45)] ring-1 ring-black/5 transition-transform duration-200 active:scale-[0.985] dark:ring-white/10">
      <button type="button" className="block w-full text-left" onClick={() => nav(`/deals/${deal.id}`)}>
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 text-white/95">
              <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          <span className="deal-badge-float absolute left-3 top-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-1.5 text-[11px] font-black tracking-wide text-white shadow-[0_8px_18px_-6px_rgba(234,88,12,0.85)]">
            {deal.badge || "DEAL"}
          </span>

          {ending ? (
            <span className="deal-ending-glow absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-black text-white shadow-md">
              <Clock className="h-3 w-3" />
              Limited Time
            </span>
          ) : null}

          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {badges
              .filter((b) => b !== "Ending Soon" && b !== "Limited Time")
              .slice(0, 2)
              .map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md"
                >
                  {b}
                </span>
              ))}
          </div>
        </div>
      </button>

      <div className="space-y-2.5 px-3.5 pb-3.5 pt-3">
        <button type="button" className="w-full text-left" onClick={() => nav(`/deals/${deal.id}`)}>
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-foreground">
            {deal.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="truncate font-semibold text-foreground/90">{biz?.name || "Business"}</span>
            {biz?.is_verified ? <VerifiedBusinessBadge /> : null}
          </p>

          {reviewCount > 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Stars rating={rating || 5} />
              <span className="font-semibold text-foreground/80">{(rating || 5).toFixed(1)}</span>
              <span>({reviewCount})</span>
            </p>
          ) : null}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
              <Clock className="h-3 w-3" />
              {countdown}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {formatDistance(deal.distance_miles, deal.location_type) || "Local"}
            </span>
            {(deal.claims_count || 0) >= 5 ? (
              <span className="font-medium">
                <ClaimCount value={deal.claims_count || 0} />
              </span>
            ) : null}
            {remaining != null && remaining <= 20 && redeemable ? (
              <span className="font-semibold text-orange-600">{remaining} left</span>
            ) : null}
          </p>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave?.(deal)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 shadow-sm"
            aria-label={deal.saved ? "Unsave deal" : "Save deal"}
          >
            <Bookmark className={`h-4 w-4 ${deal.saved ? "fill-foreground" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onShare?.(deal)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 shadow-sm"
            aria-label="Share deal"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!redeemable}
            onClick={() => nav(`/deals/${deal.id}`)}
            className="ml-auto h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-xs font-black text-white shadow-[0_10px_20px_-10px_rgba(234,88,12,0.9)] transition active:scale-[0.98] disabled:opacity-40"
          >
            Claim Deal →
          </button>
        </div>
      </div>
    </article>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[1.35rem] bg-muted/50 shadow-sm ring-1 ring-border">
      <div className="aspect-[16/10] bg-muted" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}
