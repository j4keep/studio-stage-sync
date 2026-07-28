import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETPLACE_CATEGORIES, getRecentSearches, pushRecentSearch, removeRecentSearch } from "@/lib/marketplace";
import { listMarketplaceListings, toggleSaveListing, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import { toast } from "sonner";

export default function MarketplaceSearchPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") || "";
  const [q, setQ] = useState(initial);
  const [recents, setRecents] = useState(getRecentSearches);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initial));

  const runSearch = async (term: string) => {
    const t = term.trim();
    setQ(t);
    setSearched(true);
    if (t) {
      pushRecentSearch(t);
      setRecents(getRecentSearches());
      setParams({ q: t });
    }
    setLoading(true);
    try {
      setListings(await listMarketplaceListings({ q: t || undefined, viewerId: user?.id, limit: 60 }));
    } catch (e: any) {
      toast.error(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catMatches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return MARKETPLACE_CATEGORIES.filter((c) => c.label.toLowerCase().includes(n) || c.id.includes(n)).slice(0, 4);
  }, [q]);

  const onToggleSave = async (listing: MarketplaceListing) => {
    if (!user) return toast.error("Sign in to save");
    const next = !listing.saved;
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: next } : l)));
    try {
      await toggleSaveListing(user.id, listing.id, next);
    } catch {
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: !next } : l)));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => nav("/marketplace")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold">Search</h1>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(q);
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search For Sale & Free"
            autoFocus
            className="h-11 w-full rounded-full border border-border bg-muted/60 pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </header>

      {!searched ? (
        <div className="space-y-5 px-4 pt-4">
          {recents.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
              <ul className="space-y-1">
                {recents.map((r) => (
                  <li key={r} className="flex items-center gap-2">
                    <button type="button" onClick={() => void runSearch(r)} className="flex-1 rounded-xl px-2 py-2 text-left text-sm font-medium hover:bg-muted">
                      {r}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeRecentSearch(r);
                        setRecents(getRecentSearches());
                      }}
                      className="p-2 text-muted-foreground"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {catMatches.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
              {catMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => nav(`/marketplace/category/${c.id}`)}
                  className="mb-1 flex w-full rounded-xl px-2 py-2 text-left text-sm font-semibold hover:bg-muted"
                >
                  {c.label}
                </button>
              ))}
            </section>
          )}
        </div>
      ) : (
        <div className="px-3 pt-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No results{q ? ` for “${q}”` : ""}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
