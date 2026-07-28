import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import {
  approxLocation,
  formatPrice,
  getCategory,
  timeAgo,
} from "@/lib/marketplace";
import { listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";

type Props = {
  listing: MarketplaceListing;
  onToggleSave?: (listing: MarketplaceListing) => void;
  /** Featured hero card — full width landscape */
  featured?: boolean;
};

function CoverImage({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-primary/30 via-fuchsia-500/20 to-muted text-3xl ${className || ""}`}>
        ✦
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={className || "h-full w-full object-cover"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** YAJ listing row — title-first editorial card (not OfferUp square grid). */
export default function ListingCard({ listing, onToggleSave, featured }: Props) {
  const nav = useNavigate();
  const mileage = listing.vehicle?.mileage;
  const status = listing.status;
  const cat = getCategory(listing.category);
  const cover = listingCoverUrl(listing);
  const priceLabel = formatPrice(listing.price, listing.listing_type);

  if (featured) {
    return (
      <button
        type="button"
        onClick={() => nav(`/marketplace/listing/${listing.id}`)}
        className="group w-full overflow-hidden rounded-[1.75rem] border border-border/70 bg-card text-left shadow-sm transition active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] bg-muted">
          <CoverImage src={cover} className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-black text-primary-foreground shadow-md">
            {priceLabel}
          </div>
          {(status === "sold" || status === "pending") && (
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              {status}
            </span>
          )}
        </div>
        <div className="space-y-1 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {cat?.label || "Listing"} · {timeAgo(listing.created_at)}
          </p>
          <p className="text-lg font-black leading-tight text-foreground">{listing.title}</p>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-base font-black text-primary">{priceLabel}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {approxLocation(listing.city, listing.state, listing.location_approx)}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => nav(`/marketplace/listing/${listing.id}`)}
      className="group flex w-full gap-3 rounded-2xl border border-border/80 bg-card/80 p-2.5 text-left shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur transition active:scale-[0.99]"
    >
      <div className="relative h-[5.75rem] w-[5.75rem] shrink-0 overflow-hidden rounded-xl bg-muted">
        <CoverImage src={cover} className="h-full w-full object-cover" />
        {(status === "sold" || status === "pending") && (
          <span className="absolute inset-x-1 bottom-1 rounded-md bg-black/65 py-0.5 text-center text-[8px] font-bold uppercase text-white">
            {status}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground">{listing.title}</p>
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-label={listing.saved ? "Unsave" : "Save"}
            >
              <Bookmark className={`h-3.5 w-3.5 ${listing.saved ? "fill-primary text-primary" : ""}`} />
            </span>
          )}
        </div>
        <p className="mt-1 text-[15px] font-black tracking-tight text-primary">{priceLabel}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {approxLocation(listing.city, listing.state, listing.location_approx)}
          {" · "}
          {timeAgo(listing.created_at)}
          {mileage != null ? ` · ${mileage.toLocaleString()} mi` : ""}
        </p>
        {listing.promoted && (
          <span className="mt-1 inline-block rounded-md bg-primary/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
            Boosted
          </span>
        )}
      </div>
    </button>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-2.5">
      <div className="h-[5.75rem] w-[5.75rem] shrink-0 animate-pulse rounded-xl bg-muted" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
