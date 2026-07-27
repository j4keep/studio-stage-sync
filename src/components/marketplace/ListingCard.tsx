import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import {
  approxLocation,
  formatPrice,
  timeAgo,
} from "@/lib/marketplace";
import type { MarketplaceListing } from "@/lib/marketplace-api";

type Props = {
  listing: MarketplaceListing;
  onToggleSave?: (listing: MarketplaceListing) => void;
};

export default function ListingCard({ listing, onToggleSave }: Props) {
  const nav = useNavigate();
  const mileage = listing.vehicle?.mileage;
  const status = listing.status;

  return (
    <button
      type="button"
      onClick={() => nav(`/marketplace/listing/${listing.id}`)}
      className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition active:scale-[0.98]"
    >
      <div className="relative aspect-square bg-muted">
        {listing.cover_url ? (
          <img src={listing.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">🛍</div>
        )}
        {listing.promoted && (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
            Promoted
          </span>
        )}
        {(status === "sold" || status === "pending") && (
          <span
            className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${
              status === "sold" ? "bg-foreground/80" : "bg-amber-500"
            }`}
          >
            {status}
          </span>
        )}
        {onToggleSave && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(listing);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onToggleSave(listing);
              }
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            aria-label={listing.saved ? "Unsave" : "Save"}
          >
            <Heart className={`h-4 w-4 ${listing.saved ? "fill-rose-500 text-rose-500" : ""}`} />
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="text-sm font-black text-foreground">{formatPrice(listing.price, listing.listing_type)}</p>
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">{listing.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {approxLocation(listing.city, listing.state, listing.location_approx)}
          {" · "}
          {timeAgo(listing.created_at)}
        </p>
        {mileage != null && (
          <p className="text-[10px] font-medium text-muted-foreground">{mileage.toLocaleString()} mi</p>
        )}
      </div>
    </button>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
