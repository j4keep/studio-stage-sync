import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MapPin, MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace";
import {
  ensureMarketplaceProfile,
  listMarketplaceListings,
  toggleSaveListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";
import { toast } from "sonner";

export default function MarketplaceHomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("Near you");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        const p = await ensureMarketplaceProfile(user.id);
        setAvatar(p.avatar_url);
        if (p.city) setLocationLabel(p.city);
      }
      const rows = await listMarketplaceListings({ viewerId: user?.id, limit: 40 });
      setListings(rows);
    } catch (e: any) {
      toast.error(e?.message || "Could not load marketplace");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleSave = async (listing: MarketplaceListing) => {
    if (!user) {
      toast.error("Sign in to save listings");
      return;
    }
    const next = !listing.saved;
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: next } : l)));
    try {
      await toggleSaveListing(user.id, listing.id, next);
    } catch {
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, saved: !next } : l)));
      toast.error("Could not update saved");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Create • Connect • Elevate</p>
            <h1 className="text-lg font-black tracking-tight">YAJ Marketplace</h1>
          </div>
          <button
            type="button"
            onClick={() => toast.message("Pick a city in Marketplace Settings")}
            className="flex max-w-[7rem] items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[11px] font-semibold"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{locationLabel}</span>
          </button>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => nav("/marketplace/messages")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Messages"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => user && nav(`/marketplace/profile/${user.id}`)}
            className="h-9 w-9 overflow-hidden rounded-full bg-muted"
            aria-label="Marketplace profile"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">MP</span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => nav("/marketplace/search")}
          className="relative flex h-12 w-full items-center rounded-2xl border border-border bg-muted pl-10 pr-4 text-left text-sm text-muted-foreground"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          Search Marketplace
        </button>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {MARKETPLACE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => nav(`/marketplace/category/${c.id}`)}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm"
          >
            <span className="mr-1">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      <section className="px-3 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center">
            <p className="text-base font-black">No listings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to sell something nearby.</p>
            <button
              type="button"
              onClick={() => nav("/marketplace/create")}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Sell an item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
            ))}
          </div>
        )}
      </section>

      <MarketplaceNav />
    </div>
  );
}
