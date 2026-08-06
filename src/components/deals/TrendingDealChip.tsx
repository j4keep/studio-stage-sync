import { Clock, MapPin, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistance, isEndingSoon } from "@/lib/deals";
import { dealCoverUrl, type Deal } from "@/lib/deals-api";
import { useCountdownLabel } from "@/hooks/use-countdown-label";
import VerifiedBusinessBadge from "@/components/deals/VerifiedBusinessBadge";

/** Compact horizontal “Trending Nearby” card. */
export default function TrendingDealChip({ deal }: { deal: Deal }) {
  const nav = useNavigate();
  const cover = dealCoverUrl(deal);
  const biz = deal.deal_businesses;
  const rating = Number(biz?.avg_rating || 0);
  const ending = isEndingSoon(deal.expires_at);
  const countdown = useCountdownLabel(deal.expires_at);

  return (
    <button
      type="button"
      onClick={() => nav(`/deals/${deal.id}`)}
      className="w-[11.5rem] shrink-0 overflow-hidden rounded-2xl bg-card text-left shadow-[0_10px_24px_-16px_rgba(15,23,42,0.5)] ring-1 ring-black/5 transition active:scale-[0.98] dark:ring-white/10"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-amber-500 text-2xl text-white">
            🏷️
          </div>
        )}
        <span className="deal-badge-float absolute left-2 top-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-1 text-[10px] font-black text-white shadow-md">
          {deal.badge || "DEAL"}
        </span>
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="flex items-center gap-1 truncate text-xs font-bold">
          <span className="truncate">{biz?.name || "Business"}</span>
          {biz?.is_verified ? <VerifiedBusinessBadge compact /> : null}
        </p>
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground/90">{deal.title}</p>
        {biz?.review_count ? (
          <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
          </p>
        ) : null}
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatDistance(deal.distance_miles, deal.location_type) || "Local"}</span>
        </p>
        <p
          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
            ending ? "text-orange-600" : "text-muted-foreground"
          }`}
        >
          <Clock className="h-3 w-3" />
          {countdown}
        </p>
      </div>
    </button>
  );
}
