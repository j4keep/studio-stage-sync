import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, MapPin, MessageCircle, Search, Sparkles } from "lucide-react";
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

const CAT_TINTS = [
  "from-rose-400/90 to-orange-300/80",
  "from-sky-400/90 to-cyan-300/80",
  "from-violet-400/90 to-fuchsia-300/80",
  "from-emerald-400/80 to-lime-300/70",
  "from-amber-400/90 to-yellow-300/80",
  "from-indigo-400/90 to-blue-300/80",
];

function isMissingTableError(msg: string) {
  return /marketplace_profiles|schema cache|does not exist/i.test(msg);
}

export default function MarketplaceHomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("Near you");
  const [setupNeeded, setSetupNeeded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSetupNeeded(false);
    try {
      if (user) {
        const p = await ensureMarketplaceProfile(user.id);
        setAvatar(p.avatar_url);
        if (p.city) setLocationLabel(p.city);
      }
      const rows = await listMarketplaceListings({ viewerId: user?.id, limit: 40 });
      setListings(rows);
    } catch (e: any) {
      const msg = e?.message || "Could not load marketplace";
      if (isMissingTableError(msg)) {
        setSetupNeeded(true);
        toast.error("Marketplace tables aren’t in Supabase yet — run the migration once.");
      } else {
        toast.error(msg);
      }
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

  const featured = listings[0];
  const rest = listings.slice(1);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-32 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.22),_transparent_60%)]"
      />

      <header className="relative z-20 px-4 pb-2 pt-4">
        <div className="mb-4 flex items-start gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/80"
            aria-label="Back to Explore"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">YAJ · Local commerce</p>
            <h1 className="mt-0.5 font-black tracking-tight">
              <span className="block text-[2rem] leading-none">Market</span>
              <span className="block text-lg font-bold text-muted-foreground">Buy & sell with the community</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => nav("/marketplace/settings")}
            className="mt-1 flex max-w-[6.5rem] items-center gap-1 rounded-2xl border border-border/70 bg-card/80 px-2.5 py-2 text-[11px] font-semibold backdrop-blur"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{locationLabel}</span>
          </button>
          <button type="button" className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card/80" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => nav("/marketplace/messages")}
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card/80"
            aria-label="Messages"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => user && nav(`/marketplace/profile/${user.id}`)}
            className="mt-1 h-10 w-10 overflow-hidden rounded-2xl border border-border/70 bg-muted"
            aria-label="Marketplace profile"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">Y</span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => nav("/marketplace/search")}
          className="relative flex h-12 w-full items-center rounded-2xl border border-border/80 bg-card/90 pl-11 pr-4 text-left text-sm text-muted-foreground shadow-sm backdrop-blur"
        >
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          Search people, brands, rides…
        </button>
      </header>

      {setupNeeded && (
        <div className="relative z-10 mx-4 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-bold">One-time database setup needed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pushing code does not create tables. In Supabase → SQL Editor, run the file{" "}
            <span className="font-semibold text-foreground">supabase/migrations/20260727160000_marketplace_phase1.sql</span>, then tap Retry.
          </p>
          <button type="button" onClick={() => void load()} className="mt-2 text-xs font-bold text-primary">
            Retry
          </button>
        </div>
      )}

      <section className="relative z-10 px-4 pt-5">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-black">Shop by vibe</h2>
          <button type="button" onClick={() => nav("/marketplace/search")} className="text-[11px] font-bold text-primary">
            See all
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MARKETPLACE_CATEGORIES.slice(0, 6).map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => nav(`/marketplace/category/${c.id}`)}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${CAT_TINTS[i % CAT_TINTS.length]} p-3 text-left text-white shadow-sm`}
            >
              <span className="text-lg">{c.emoji}</span>
              <p className="mt-1 text-[11px] font-black leading-tight drop-shadow-sm">{c.label}</p>
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MARKETPLACE_CATEGORIES.slice(6).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => nav(`/marketplace/category/${c.id}`)}
              className="shrink-0 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-[11px] font-semibold"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-4 mt-5 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 p-4 text-primary-foreground shadow-sm">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold">
          <Sparkles className="h-3 w-3" /> List something
        </span>
        <p className="mt-2 text-lg font-black leading-tight">Turn closet clutter into cash</p>
        <p className="mt-1 text-[11px] text-white/90">Photos, price, neighborhood — live in under a minute.</p>
        <button
          type="button"
          onClick={() => nav("/marketplace/create")}
          className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-foreground"
        >
          Start a listing
        </button>
      </section>

      <section className="relative z-10 space-y-3 px-4 pt-6">
        <h2 className="text-sm font-black">Fresh near you</h2>
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border px-4 py-14 text-center">
            <p className="text-base font-black">Nothing listed yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first drop in your city.</p>
            <button
              type="button"
              onClick={() => nav("/marketplace/create")}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              List an item
            </button>
          </div>
        ) : (
          <>
            {featured && <ListingCard listing={featured} featured onToggleSave={onToggleSave} />}
            <div className="space-y-2.5">
              {rest.map((l) => (
                <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
              ))}
            </div>
          </>
        )}
      </section>

      <MarketplaceNav />
    </div>
  );
}
