import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Pencil, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETPLACE_CATEGORIES, getRecentSearches, pushRecentSearch } from "@/lib/marketplace";
import {
  listMarketplaceListings,
  toggleSaveListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import fiveUnderBanner from "@/assets/five-under-banner-v3.png.asset.json";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";
import MessagesInboxButton from "@/components/MessagesInboxButton";
import { toast } from "sonner";

type FilterId = "mine" | "all" | "free" | "distance" | "relevant" | "discounted";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "mine", label: "My Listings" },
  { id: "all", label: "All Categories" },
  { id: "free", label: "Free" },
  { id: "distance", label: "15 mi" },
  { id: "relevant", label: "Most Relevant" },
  { id: "discounted", label: "Discounted" },
];

function isMissingTableError(msg: string) {
  return /marketplace_profiles|marketplace_listings|schema cache|does not exist/i.test(msg);
}

/** Clean YAJ Marketplace home — Nextdoor-style structure, YAJ identity. */
export default function MarketplaceHomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [sellerRatings, setSellerRatings] = useState<Record<string, DisplayRating>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [recents, setRecents] = useState(getRecentSearches);
  const [filter, setFilter] = useState<FilterId>("relevant");
  const [category, setCategory] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSetupNeeded(false);
    try {
      const opts: Parameters<typeof listMarketplaceListings>[0] = {
        viewerId: user?.id,
        limit: 48,
        excludeFiveUnder: true,
        sort: filter === "relevant" ? "newest" : "newest",
      };
      if (filter === "mine" && user) opts.sellerId = user.id;
      if (filter === "free") opts.category = "free";
      if (category) opts.category = category;
      if (q.trim()) opts.q = q.trim();
      let rows = await listMarketplaceListings(opts);
      if (filter === "free") rows = rows.filter((l) => l.listing_type === "free" || Number(l.price) === 0);
      setListings(rows);
      const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
      if (sellerIds.length) {
        setSellerRatings(await fetchRatingsByUserIds(sellerIds));
      } else {
        setSellerRatings({});
      }
    } catch (e: any) {
      const msg = e?.message || "Could not load marketplace";
      if (isMissingTableError(msg)) {
        setSetupNeeded(true);
        toast.error("Marketplace tables aren’t in Supabase yet — run the migration once.");
      } else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user, filter, category, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleSave = async (listing: MarketplaceListing) => {
    if (!user) return toast.error("Sign in to save listings");
    const next = !listing.saved;
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: next } : l)));
    try {
      await toggleSaveListing(user.id, listing.id, next);
    } catch {
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: !next } : l)));
    }
  };

  const runSearch = (term: string) => {
    const t = term.trim();
    setQ(t);
    if (t) {
      pushRecentSearch(t);
      setRecents(getRecentSearches());
    }
    setSearchFocus(false);
  };

  const newest = useMemo(() => listings.slice(0, 8), [listings]);
  const freeItems = useMemo(
    () => listings.filter((l) => l.listing_type === "free" || Number(l.price) === 0).slice(0, 4),
    [listings],
  );
  const vehicles = useMemo(
    () => listings.filter((l) => ["automotive", "vehicle", "motorcycle", "boat", "rv"].includes(String(l.listing_type))).slice(0, 4),
    [listings],
  );

  const onFilter = (id: FilterId) => {
    if (id === "all") {
      setCategory(null);
      setFilter("all");
      return;
    }
    if (id === "mine") {
      if (!user) {
        toast.error("Sign in to see your listings");
        return;
      }
      nav("/marketplace/account");
      return;
    }
    setFilter(id);
  };

  return (
    <div className="relative min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back to Explore"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">Marketplace</h1>
          <MessagesInboxButton />
          <button
            type="button"
            onClick={() => nav("/marketplace/account")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => window.setTimeout(() => setSearchFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(q);
            }}
            placeholder="Search For Sale & Free"
            className="h-11 w-full rounded-full border border-border bg-muted/60 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          />
          {searchFocus && recents.length > 0 && !q && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  onMouseDown={() => runSearch(r)}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filter === f.id || (f.id === "all" && !category && filter === "all")
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => nav("/marketplace/five-under")}
          className="block w-full overflow-hidden rounded-[1.35rem] border border-border shadow-sm active:scale-[0.99]"
          aria-label="Shop $1–$5 Finds — everything five dollars or less"
        >
          <img
            src={fiveUnderBanner.url}
            alt="$1–$5 Finds — everything five dollars or less, near you. Local finds, pick up or delivery."
            width={1888}
            height={720}
            className="block h-auto w-full"
            loading="lazy"
          />
        </button>
      </div>

      <div className="px-3 pt-3">
        <MarketplaceSafetyTips variant="card" />
      </div>

      {setupNeeded && (
        <div className="mx-4 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold">One-time database setup needed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run <span className="font-medium text-foreground">supabase/migrations/20260727160000_marketplace_phase1.sql</span> in
            Supabase SQL Editor, then retry.
          </p>
          <button type="button" onClick={() => void load()} className="mt-2 text-xs font-bold text-primary">
            Retry
          </button>
        </div>
      )}

      <div className="space-y-6 px-3 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <p className="font-semibold">No listings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to post something nearby.</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-base font-bold">Newest</h2>
              <div className="grid grid-cols-2 gap-3">
                {newest.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onToggleSave={onToggleSave}
                    sellerRating={sellerRatings[l.seller_id]}
                  />
                ))}
              </div>
              {listings.length > 8 && (
                <button
                  type="button"
                  onClick={() => nav("/marketplace/search?q=")}
                  className="mt-3 h-11 w-full rounded-full bg-muted text-sm font-semibold"
                >
                  See all new listings
                </button>
              )}
            </section>

            {freeItems.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold">Free Items</h2>
                <div className="grid grid-cols-2 gap-3">
                  {freeItems.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      onToggleSave={onToggleSave}
                      sellerRating={sellerRatings[l.seller_id]}
                    />
                  ))}
                </div>
              </section>
            )}

            {vehicles.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold">Vehicles</h2>
                <div className="grid grid-cols-2 gap-3">
                  {vehicles.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      onToggleSave={onToggleSave}
                      sellerRating={sellerRatings[l.seller_id]}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-base font-bold">Near You</h2>
              <div className="grid grid-cols-2 gap-3">
                {listings.slice(0, 12).map((l) => (
                  <ListingCard
                    key={`near-${l.id}`}
                    listing={l}
                    onToggleSave={onToggleSave}
                    sellerRating={sellerRatings[l.seller_id]}
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Browse categories</h2>
              <div className="flex flex-wrap gap-2">
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategory(c.id);
                      setFilter("all");
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      category === c.id ? "border-foreground bg-foreground text-background" : "border-border"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => nav("/marketplace/create")}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg lg:bottom-8"
        aria-label="Post listing"
      >
        <Pencil className="h-4 w-4" />
        Post
      </button>
    </div>
  );
}
