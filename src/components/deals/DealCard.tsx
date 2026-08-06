import { Bookmark, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  formatDistance,
  formatExpiresLabel,
  getCategoryLabel,
  remainingClaims,
  statusBadges,
} from "@/lib/deals";
import { dealCoverUrl, type Deal } from "@/lib/deals-api";

type Props = {
  deal: Deal;
  onSave?: (deal: Deal) => void;
  onShare?: (deal: Deal) => void;
};

export default function DealCard({ deal, onSave, onShare }: Props) {
  const nav = useNavigate();
  const cover = dealCoverUrl(deal);
  const badges = statusBadges(deal);
  const remaining = remainingClaims(deal);
  const biz = deal.deal_businesses;
  const redeemable = !badges.includes("Expired") && !badges.includes("Sold Out");

  return (
    <article className="overflow-hidden rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-50/80 via-background to-amber-50/40 shadow-sm dark:from-orange-950/20 dark:via-background dark:to-amber-950/10">
      <button type="button" className="block w-full text-left" onClick={() => nav(`/deals/${deal.id}`)}>
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-amber-500 text-white/90">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-1 text-[10px] font-black tracking-wide text-white shadow">
            {deal.badge || "DEAL"}
          </span>
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {badges.slice(0, 2).map((b) => (
              <span
                key={b}
                className="rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </button>

      <div className="space-y-2 p-3">
        <button type="button" className="w-full text-left" onClick={() => nav(`/deals/${deal.id}`)}>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{deal.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">{biz?.name || "Business"}</span>
            {biz?.is_verified ? (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white">
                ✓
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {getCategoryLabel(deal.category)}
            {" · "}
            {formatDistance(deal.distance_miles, deal.location_type) || "Local"}
            {" · "}
            {formatExpiresLabel(deal.expires_at)}
          </p>
          {remaining != null && remaining <= 20 && redeemable ? (
            <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
              {remaining} left
            </p>
          ) : null}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave?.(deal)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label={deal.saved ? "Unsave deal" : "Save deal"}
          >
            <Bookmark className={`h-4 w-4 ${deal.saved ? "fill-foreground" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onShare?.(deal)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Share deal"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!redeemable}
            onClick={() => nav(`/deals/${deal.id}`)}
            className="ml-auto h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            View Deal
          </button>
        </div>
      </div>
    </article>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-muted/40">
      <div className="aspect-[16/10] bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}
