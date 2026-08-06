import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  MapPin,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEAL_CATEGORIES,
  DEAL_FILTERS,
  formatDealLocationLabel,
  formatDistance,
  getDealLocationPrefs,
  setDealLocationPrefs,
  type DealFilterId,
  type DealLocationPrefs,
} from "@/lib/deals";
import {
  dealCoverUrl,
  isMissingTableError,
  listDeals,
  toggleSaveDeal,
  type Deal,
} from "@/lib/deals-api";
import DealCard, { DealCardSkeleton } from "@/components/deals/DealCard";
import { toast } from "sonner";
import emptyHero from "@/assets/deals/deals-empty-hero.jpg";
import lifestyleDining from "@/assets/deals/deals-lifestyle-dining.jpg";
import lifestyleShop from "@/assets/deals/deals-lifestyle-shop.jpg";

const SHOWCASE = [
  {
    id: "showcase-1",
    eyebrow: "Today’s Featured Deal",
    title: "Local savings start here",
    subtitle: "Restaurants, shops, salons & more near you",
    cta: "Explore Deals",
    image: emptyHero,
    distance: null as string | null,
  },
  {
    id: "showcase-2",
    eyebrow: "Today’s Featured Deal",
    title: "Dinner nights, better prices",
    subtitle: "Discover limited offers from nearby kitchens",
    cta: "See Food Deals",
    image: lifestyleDining,
    distance: "Near you",
  },
  {
    id: "showcase-3",
    eyebrow: "Today’s Featured Deal",
    title: "Support local. Save more.",
    subtitle: "Verified businesses posting fresh promotions",
    cta: "Browse Shopping",
    image: lifestyleShop,
    distance: "Local picks",
  },
] as const;

export default function DealsHomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DealFilterId>("for-you");
  const [category, setCategory] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [featured, setFeatured] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [loc, setLoc] = useState<DealLocationPrefs>(() => getDealLocationPrefs());
  const [showLoc, setShowLoc] = useState(false);
  const [locDraft, setLocDraft] = useState(loc);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setSetupNeeded(false);
    try {
      const [all, feat] = await Promise.all([
        listDeals({
          q,
          filter,
          category,
          viewerId: user?.id,
          location: loc,
          limit: 60,
        }),
        listDeals({
          featuredOnly: true,
          viewerId: user?.id,
          location: loc,
          limit: 8,
        }),
      ]);
      setDeals(all);
      setFeatured(feat.length ? feat : all.filter((d) => d.is_sponsored || d.is_featured).slice(0, 5));
    } catch (e: any) {
      const msg = e?.message || "Could not load deals";
      if (e?.setupNeeded || isMissingTableError(msg)) {
        setSetupNeeded(true);
      } else if (!/expire_stale_deals|Could not find the function/i.test(msg)) {
        toast.error(msg);
      }
      setDeals([]);
      setFeatured([]);
    } finally {
      setLoading(false);
    }
  }, [q, filter, category, user?.id, loc]);

  useEffect(() => {
    void load();
  }, [load]);

  const bannerCount = featured.length || SHOWCASE.length;

  useEffect(() => {
    if (bannerCount <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % bannerCount), 4500);
    return () => clearInterval(t);
  }, [bannerCount]);

  useEffect(() => {
    setHeroIdx(0);
  }, [featured.length]);

  const sections = useMemo(() => {
    const ending = [...deals]
      .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
      .slice(0, 8);
    const newest = [...deals]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
    const popular = [...deals]
      .sort((a, b) => (b.claims_count || 0) - (a.claims_count || 0))
      .slice(0, 8);
    return {
      recommended: deals.slice(0, 8),
      ending,
      newest,
      popular,
    };
  }, [deals]);

  const onSave = async (deal: Deal) => {
    if (!user) return toast.error("Sign in to save deals");
    const next = !deal.saved;
    const patch = (list: Deal[]) => list.map((d) => (d.id === deal.id ? { ...d, saved: next } : d));
    setDeals(patch);
    setFeatured(patch);
    try {
      await toggleSaveDeal(user.id, deal.id, next);
    } catch {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, saved: !next } : d)));
      setFeatured((prev) => prev.map((d) => (d.id === deal.id ? { ...d, saved: !next } : d)));
      toast.error("Could not update save");
    }
  };

  const onShare = async (deal: Deal) => {
    const url = `${window.location.origin}${window.location.pathname}#/deals/${deal.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: deal.title, text: deal.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const saveLocation = () => {
    const next = setDealLocationPrefs(locDraft);
    setLoc(next);
    setShowLoc(false);
    toast.success("Location updated");
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location unavailable on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocDraft((d) => ({
          ...d,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }));
        toast.success("Using your current location");
      },
      () => toast.error("Location unavailable. Enter a city or ZIP instead."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const liveHero = featured[heroIdx] || null;
  const showcase = SHOWCASE[heroIdx % SHOWCASE.length];

  return (
    <div className="relative min-h-screen bg-background pb-28 text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(251,146,60,0.22),_transparent_58%)]" />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/80 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-tight">DEALS NEAR YOU</h1>
            <p className="truncate text-[11px] text-muted-foreground">Save locally. Discover something new.</p>
          </div>
          <button
            type="button"
            onClick={() => nav("/deals/my")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/80 shadow-sm"
            aria-label="Saved Deals"
          >
            <Bookmark className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => nav("/deals/notifications")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/80 shadow-sm"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>

        {/* Rotating featured banner — above search */}
        <button
          type="button"
          onClick={() => {
            if (liveHero) nav(`/deals/${liveHero.id}`);
            else if (showcase.id.includes("2")) setCategory("food-drink");
            else if (showcase.id.includes("3")) setCategory("shopping");
            else nav("/deals/create");
          }}
          className="relative mb-3 block w-full overflow-hidden rounded-2xl text-left shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)] ring-1 ring-black/5"
        >
          <div className="relative aspect-[2.2/1] min-h-[7.5rem]">
            <img
              key={liveHero?.id || showcase.id}
              src={liveHero ? dealCoverUrl(liveHero) || showcase.image : showcase.image}
              alt=""
              className="deal-featured-photo absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
            <div className="absolute inset-0 p-3.5 text-white">
              <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md">
                <Tag className="h-3 w-3" />
                {liveHero ? "Today’s Featured Deal" : showcase.eyebrow}
              </p>
              <h2 className="mt-1.5 line-clamp-2 text-base font-black leading-tight drop-shadow">
                {liveHero
                  ? `${liveHero.badge || "DEAL"} · ${liveHero.title}`
                  : showcase.title}
              </h2>
              <p className="mt-1 line-clamp-1 text-[11px] text-white/85">
                {liveHero
                  ? [
                      liveHero.deal_businesses?.name,
                      formatDistance(liveHero.distance_miles, liveHero.location_type),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : showcase.subtitle}
              </p>
              <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-orange-600 shadow">
                {liveHero ? "Claim Now" : showcase.cta}
              </span>
            </div>
          </div>
        </button>
        {bannerCount > 1 ? (
          <div className="-mt-1 mb-3 flex justify-center gap-1.5">
            {Array.from({ length: bannerCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Featured slide ${i + 1}`}
                onClick={() => setHeroIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === heroIdx % bannerCount ? "w-5 bg-orange-500" : "w-1.5 bg-muted-foreground/25"
                }`}
              />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setLocDraft(loc);
            setShowLoc(true);
          }}
          className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-700 shadow-sm dark:text-orange-300"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{formatDealLocationLabel(loc)}</span>
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search restaurants, stores, services, or offers"
            className="h-11 w-full rounded-2xl border border-border/80 bg-muted/50 pl-10 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-orange-400/35"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      {offline ? (
        <div className="mx-3 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          You’re offline. Showing the last loaded deals when available.
        </div>
      ) : null}

      {setupNeeded ? (
        <div className="mx-3 mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-3 text-sm">
          <p className="font-semibold">Database setup needed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apply the Deals migration in Lovable Cloud / Supabase, then refresh.
          </p>
        </div>
      ) : null}

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {DEAL_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow"
                : "bg-muted/80 text-foreground shadow-sm"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="mt-4 px-3">
        <h2 className="mb-2 text-sm font-bold">Categories</h2>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {DEAL_CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(active ? null : c.id)}
                className={`relative w-[9.5rem] shrink-0 overflow-hidden rounded-2xl p-[1px] transition active:scale-[0.98] ${
                  active ? "shadow-[0_12px_28px_-14px_rgba(234,88,12,0.8)]" : "shadow-sm"
                }`}
              >
                <div
                  className={`relative h-[5.75rem] overflow-hidden rounded-[0.95rem] bg-gradient-to-br ${c.gradient} px-3 py-2.5 text-left text-white ring-1 ${
                    active ? "ring-orange-400" : "ring-white/25"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-3 -top-4 h-16 w-16 rounded-full bg-white/20 blur-xl" />
                  <p className="text-lg leading-none drop-shadow-sm">{c.emoji}</p>
                  <p className="mt-1.5 text-[13px] font-black leading-tight drop-shadow-sm">{c.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-white/90">
                    {c.blurb}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <main className="mt-6 space-y-7 px-3">
        {loading ? (
          <div className="grid gap-3">
            <DealCardSkeleton />
            <DealCardSkeleton />
          </div>
        ) : deals.length === 0 ? (
          <EmptyState
            q={q}
            filter={filter}
            onExpand={() => {
              setLocDraft({ ...loc, radiusMiles: Math.min(50, (loc.radiusMiles || 15) + 10) });
              setShowLoc(true);
            }}
            onOnline={() => setFilter("online")}
            onPost={() => nav("/deals/create")}
          />
        ) : q || category || filter !== "for-you" ? (
          <section>
            <h2 className="mb-2 text-base font-black">Results</h2>
            <div className="grid gap-3.5">
              {deals.map((d) => (
                <DealCard key={d.id} deal={d} onSave={onSave} onShare={onShare} />
              ))}
            </div>
          </section>
        ) : (
          <>
            <FeedSection title="Recommended for You" deals={sections.recommended} onSave={onSave} onShare={onShare} />
            <FeedSection title="Ending Soon" deals={sections.ending} onSave={onSave} onShare={onShare} />
            <FeedSection title="New Near You" deals={sections.newest} onSave={onSave} onShare={onShare} />
            <FeedSection title="Popular This Week" deals={sections.popular} onSave={onSave} onShare={onShare} />
          </>
        )}
      </main>

      <div className="fixed bottom-24 right-4 z-30">
        <button
          type="button"
          onClick={() => nav("/deals/business")}
          className="rounded-full bg-foreground px-4 py-2.5 text-xs font-bold text-background shadow-lg"
        >
          Business
        </button>
      </div>

      {showLoc ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-2xl bg-background p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Change location</h3>
              <button type="button" onClick={() => setShowLoc(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold">
                City
                <input
                  value={locDraft.city}
                  onChange={(e) => setLocDraft({ ...locDraft, city: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold">
                  State
                  <input
                    value={locDraft.state}
                    onChange={(e) => setLocDraft({ ...locDraft, state: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  ZIP
                  <input
                    value={locDraft.postalCode}
                    onChange={(e) => setLocDraft({ ...locDraft, postalCode: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold">
                Radius: {locDraft.radiusMiles} miles
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={locDraft.radiusMiles}
                  onChange={(e) => setLocDraft({ ...locDraft, radiusMiles: Number(e.target.value) })}
                  className="mt-2 w-full"
                />
              </label>
              <button
                type="button"
                onClick={useDeviceLocation}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold"
              >
                Use current location
              </button>
              <button
                type="button"
                onClick={saveLocation}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-sm font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedSection({
  title,
  deals,
  onSave,
  onShare,
}: {
  title: string;
  deals: Deal[];
  onSave: (d: Deal) => void;
  onShare: (d: Deal) => void;
}) {
  if (!deals.length) return null;
  return (
    <section>
      <h2 className="mb-2.5 text-base font-black tracking-tight">{title}</h2>
      <div className="grid gap-3.5">
        {deals.map((d) => (
          <DealCard key={`${title}-${d.id}`} deal={d} onSave={onSave} onShare={onShare} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  q,
  filter,
  onExpand,
  onOnline,
  onPost,
}: {
  q: string;
  filter: string;
  onExpand: () => void;
  onOnline: () => void;
  onPost: () => void;
}) {
  if (q) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-bold">No matches for “{q}”</p>
        <p className="mt-1 text-sm text-muted-foreground">Try another keyword, category, or city.</p>
      </div>
    );
  }
  if (filter === "near-me") {
    return (
      <div className="overflow-hidden rounded-[1.5rem] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/5">
        <div className="relative aspect-[4/3]">
          <img src={lifestyleDining} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/25 bg-white/15 p-4 text-white shadow-lg backdrop-blur-xl">
            <p className="text-base font-black">No deals nearby yet.</p>
            <p className="mt-1 text-xs text-white/85">Expand your distance or browse online offers.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onExpand} className="rounded-full bg-white/20 px-3 py-2 text-xs font-bold backdrop-blur">
                Expand distance
              </button>
              <button type="button" onClick={onOnline} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-orange-600">
                Browse online
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] shadow-[0_22px_48px_-24px_rgba(15,23,42,0.6)] ring-1 ring-black/5">
      <div className="relative aspect-[4/5] max-h-[28rem]">
        <img src={emptyHero} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/30 bg-white/18 p-4 text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <p className="text-lg font-black tracking-tight">🎉 Local Deals Start Here</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/90">
            Discover discounts from restaurants, shops, salons, gyms, and local businesses near you.
          </p>
          <p className="mt-2 text-[11px] font-semibold text-amber-100">Be the first business to post a deal.</p>
          <button
            type="button"
            onClick={onPost}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-sm font-black text-white shadow-[0_12px_24px_-12px_rgba(234,88,12,0.95)]"
          >
            Post Your First Deal
          </button>
        </div>
      </div>
    </div>
  );
}
