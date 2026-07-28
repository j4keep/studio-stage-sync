import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { approxLocation, formatPrice, timeAgo } from "@/lib/marketplace";
import { listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";

type Props = {
  listing: MarketplaceListing;
  onToggleSave?: (listing: MarketplaceListing) => void;
};

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40 text-2xl">·</div>;
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Clean two-column marketplace card — image, title, price · place. */
export default function ListingCard({ listing, onToggleSave }: Props) {
  const nav = useNavigate();
  const cover = listingCoverUrl(listing);
  const price = formatPrice(listing.price, listing.listing_type);
  const place = approxLocation(listing.city, listing.state, listing.location_approx);
  const status = listing.status;

  return (
    <button
      type="button"
      onClick={() => nav(`/marketplace/listing/${listing.id}`)}
      className="group w-full text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <Cover src={cover} />
        {listing.promoted && (
          <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[9px] font-semibold text-background">
            Promoted
          </span>
        )}
        {(status === "sold" || status === "pending") && (
          <span className="absolute left-2 bottom-2 rounded-md bg-foreground/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-background">
            {status}
          </span>
        )}
        {onToggleSave && (
          <span
            role="button"
            tabIndex={0}
            aria-label={listing.saved ? "Unsave" : "Save"}
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
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
          >
            <Bookmark className={`h-3.5 w-3.5 ${listing.saved ? "fill-foreground" : ""}`} />
          </span>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{listing.title}</p>
        <p className="text-[13px] text-muted-foreground">
          <span className="font-bold text-foreground">{price}</span>
          <span className="mx-1">·</span>
          <span>{place}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(listing.created_at)}</p>
      </div>
    </button>
  );
}

export function ListingCardSkeleton() {
  return (
    <div>
      <div className="aspect-square animate-pulse rounded-xl bg-muted" />
      <div className="mt-2 space-y-1.5 px-0.5">
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
