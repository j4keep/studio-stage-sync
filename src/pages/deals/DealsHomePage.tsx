import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  MapPin,
  Search,
  Store,
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
  userHasDealBusiness,
  type Deal,
} from "@/lib/deals-api";
import DealCard, { DealCardSkeleton } from "@/components/deals/DealCard";
import TrendingDealChip from "@/components/deals/TrendingDealChip";
import { toast } from "sonner";
import emptyHero from "@/assets/deals/deals-empty-hero.jpg";
import lifestyleDining from "@/assets/deals/deals-lifestyle-dining.jpg";
import lifestyleShop from "@/assets/deals/deals-lifestyle-shop.jpg";

/** Showcase slides when no live featured deals exist — marketing examples only. */
const SHOWCASE = [
  {
    id: "showcase-pizza",
    eyebrow: "Today’s Featured Deal",
    badge: "50% OFF",
    title: "Pizza Tonight",
    subtitle: "Local kitchens · limited evening specials",
    cta: "See Food Deals",
    image: lifestyleDining,
    category: "food-drink",
  },
  {
    id: "showcase-salon",
    eyebrow: "Today’s Featured Deal",
    badge: "FREE",
    title: "Hair Consultation",
    subtitle: "Salons near you · book while it lasts",
    cta: "Browse Beauty",
    image: emptyHero,
    category: "beauty",
  },
  {
    id: "showcase-coffee",
    eyebrow: "Today’s Featured Deal",
    badge: "BOGO",
    title: "Buy One Coffee Get One",
    subtitle: "Cafés & bakeries in your area",
    cta: "Find Coffee",
    image: lifestyleDining,
    category: "food-drink",
  },
  {
    id: "showcase-events",
    eyebrow: "Today’s Featured Deal",
    badge: "TODAY ONLY",
    title: "Weekend Event Specials",
    subtitle: "Tickets, shows & nights out",
    cta: "See Events",
    image: lifestyleShop,
    category: "events",
  },
] as const;

const SEARCH_HINTS = [
  "Search restaurants, stores, services, or offers",
  "🍕 Pizza",
  "☕ Coffee",
  "💇 Haircut",
  "🛒 Grocery",
  "🎬 Movie",
  "💪 Gym trial",
  "💅 Salon deals",
];

export default function DealsHomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DealFilterId>("for-you");
  const [category, setCategory] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [featured, setFeatured] = useState<Deal[]>([]);
  const [trending, setTrending] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [loc, setLoc] = useState<DealLocationPrefs>(() => getDealLocationPrefs());
  const [showLoc, setShowLoc] = useState(false);
  const [locDraft, setLocDraft] = useState(loc);
  const [heroIdx, setHeroIdx] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isDealBusiness, setIsDealBusiness] = useState(false);

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

  useEffect(() => {
    if (!user) {
      setIsDealBusiness(false);
      return;
    }
    void userHasDealBusiness(user.id).then(setIsDealBusiness);
  }, [user]);

  useEffect(() => {
    if (q || searchFocused) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 2800);
    return () => clearInterval(t);
  }, [q, searchFocused]);

  const load = useCallback(async () => {
    setLoading(true);
    setSetupNeeded(false);
    try {
      const [all, feat, trend] = await Promise.all([
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
        listDeals({
          filter: "near-me",
          viewerId: user?.id,
          location: loc,
          limit: 16,
        }),
      ]);
      setDeals(all);
      const liveFeatured =
        feat.length > 0
          ? feat
          : all.filter((d) => d.is_sponsored || d.is_featured).slice(0, 5);
      // If still empty, rotate popular active deals in the banner so it feels live.
      setFeatured(
        liveFeatured.length
          ? liveFeatured
          : [...all].sort((a, b) => (b.claims_count || 0) - (a.claims_count || 0)).slice(0, 5),
      );
      const trendSorted = [...trend]
        .sort((a, b) => {
          const dist = (a.distance_miles ?? 99) - (b.distance_miles ?? 99);
          if (Math.abs(dist) > 0.2) return dist;
          return (b.claims_count || 0) - (a.claims_count || 0);
        })
        .slice(0, 12);
      setTrending(trendSorted.length ? trendSorted : all.slice(0, 12));
    } catch (e: any) {
      const msg = e?.message || "Could not load deals";
      if (e?.setupNeeded || isMissingTableError(msg)) {
        setSetupNeeded(true);
      } else if (!/expire_stale_deals|Could not find the function/i.test(msg)) {
        toast.error(msg);
      }
      setDeals([]);
      setFeatured([]);
      setTrending([]);
    } finally {
      setLoading(false);
    }
  }, [q, filter, category, user?.id, loc]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasLiveFeatured = featured.length > 0;
  const bannerCount = hasLiveFeatured ? featured.length : SHOWCASE.length;

  useEffect(() => {
    if (bannerCount <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % bannerCount), 3500);
    return () => clearInterval(t);
  }, [bannerCount]);

  useEffect(() => {
    setHeroIdx(0);
  }, [featured.length, hasLiveFeatured]);

  const activity = useMemo(() => {
    const pool = [...deals, ...trending, ...featured];
    const seen = new Set<string>();
    let claims = 0;
    let newThisWeek = 0;
    const weekAgo = Date.now() - 7 * 24 * 3_600_000;
    for (const d of pool) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      claims += d.claims_count || 0;
      if (new Date(d.created_at).getTime() >= weekAgo) newThisWeek += 1;
    }
    return { claims, newThisWeek, active: seen.size };
  }, [deals, trending, featured]);

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
    setTrending(patch);
    try {
      await toggleSaveDeal(user.id, deal.id, next);
    } catch {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, saved: !next } : d)));
      setFeatured((prev) => prev.map((d) => (d.id === deal.id ? { ...d, saved: !next } : d)));
      setTrending((prev) => prev.map((d) => (d.id === deal.id ? { ...d, saved: !next } : d)));
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

  const liveHero = hasLiveFeatured ? featured[heroIdx % featured.length] : null;
  const showcase = SHOWCASE[heroIdx % SHOWCASE.length];
  const bannerBadge = liveHero?.badge || showcase.badge;
  const placeholder = searchFocused || q ? SEARCH_HINTS[0] : SEARCH_HINTS[hintIdx];
  const isEmptyFeed = !loading && deals.length === 0 && !q.trim();

  return (
    <div
      className={
        isEmptyFeed
          ? "relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]"
          : "relative min-h-screen bg-background pb-28 text-foreground"
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(251,146,60,0.22),_transparent_58%)]" />

      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/85 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
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
          {/* Subtle business shortcut — owners only */}
          {isDealBusiness ? (
            <button
              type="button"
              onClick={() => nav("/deals/business")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/80 shadow-sm"
              aria-label="Business Dashboard"
            >
              <Store className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            if (liveHero) nav(`/deals/${liveHero.id}`);
            else if (showcase.category) setCategory(showcase.category);
            else nav("/deals/create");
          }}
          className="relative mb-2 block w-full overflow-hidden rounded-2xl text-left shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)] ring-1 ring-black/5"
        >
          <div className="relative aspect-[2.15/1] min-h-[8rem]">
            <img
              key={liveHero?.id || showcase.id}
              src={liveHero ? dealCoverUrl(liveHero) || showcase.image : showcase.image}
              alt=""
              className="deal-featured-photo absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />

            {/* Giant floating savings badge */}
            <div className="deal-badge-float absolute right-3 top-3 z-10 flex max-w-[42%] flex-col items-end">
              <span className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 px-3 py-2 text-right text-lg font-black leading-none tracking-tight text-white shadow-[0_12px_28px_-8px_rgba(234,88,12,0.95)] ring-2 ring-white/40">
                {bannerBadge}
              </span>
            </div>

            <div className="absolute inset-0 flex flex-col justify-end p-3.5 pr-28 text-white">
              <p className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md">
                <Tag className="h-3 w-3" />
                Today’s Featured Deal
              </p>
              <h2 className="mt-1.5 line-clamp-2 text-[1.05rem] font-black leading-tight drop-shadow">
                {liveHero ? liveHero.title : showcase.title}
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
              <span className="mt-2 inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-orange-600 shadow">
                {liveHero ? "Claim Now" : showcase.cta}
              </span>
            </div>
          </div>
        </button>

        {bannerCount > 1 ? (
          <div className="mb-2 flex justify-center gap-1.5">
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

        {/* Real activity only — never invent counts */}
        {!loading && (activity.claims > 0 || activity.newThisWeek > 0) ? (
          <p className="mb-2 text-center text-[11px] font-semibold text-orange-700 dark:text-orange-300">
            {activity.claims > 0
              ? `🔥 ${activity.claims.toLocaleString()} deal claim${activity.claims === 1 ? "" : "s"} so far`
              : null}
            {activity.claims > 0 && activity.newThisWeek > 0 ? " · " : null}
            {activity.newThisWeek > 0
              ? `🎉 ${activity.newThisWeek} new deal${activity.newThisWeek === 1 ? "" : "s"} this week`
              : null}
          </p>
        ) : !loading && !hasLiveFeatured ? (
          <p className="mb-2 text-center text-[11px] font-medium text-muted-foreground">
            Fresh local offers rotate here as businesses post
          </p>
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={placeholder}
            className="h-11 w-full rounded-2xl border border-border/80 bg-muted/50 pl-10 pr-10 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-orange-400/35"
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

      <div className="no-scrollbar mt-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-1">
        {DEAL_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow"
                : "bg-slate-300/90 text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="mt-3 shrink-0 px-3">
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

      {!loading && trending.length > 0 ? (
        <section className="mt-5 shrink-0 px-3">
          <h2 className="mb-2 text-base font-black tracking-tight">🔥 Trending Nearby</h2>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {trending.map((d) => (
              <TrendingDealChip key={d.id} deal={d} />
            ))}
          </div>
        </section>
      ) : null}

      <main
        className={
          isEmptyFeed
            ? "mt-3 flex min-h-0 flex-1 flex-col px-3 pb-2"
            : "mt-6 space-y-7 px-3"
        }
      >
        {loading ? (
          <div className="grid gap-3">
            <DealCardSkeleton />
            <DealCardSkeleton />
          </div>
        ) : deals.length === 0 ? (
          // Onboarding hero fills remaining viewport — no dead white below
          <EmptyState
            q={q}
            filter={filter}
            fillViewport={isEmptyFeed}
            onExpand={() => {
              setLocDraft({ ...loc, radiusMiles: Math.min(50, (loc.radiusMiles || 15) + 10) });
              setShowLoc(true);
            }}
            onOnline={() => setFilter("online")}
            onBecomeBusiness={() => nav("/deals/become-business")}
            isDealBusiness={isDealBusiness}
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
            <FeedSection title="Today’s Deals" deals={sections.recommended} onSave={onSave} onShare={onShare} />
            <FeedSection title="Nearby Deals" deals={sections.newest} onSave={onSave} onShare={onShare} />
            <FeedSection title="Ending Soon" deals={sections.ending} onSave={onSave} onShare={onShare} />
            <FeedSection title="Popular Deals" deals={sections.popular} onSave={onSave} onShare={onShare} />
          </>
        )}

        {/* Only when deals exist — empty state already includes Become a Business */}
        {!loading && !isDealBusiness && deals.length > 0 ? (
          <section className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-amber-400/5 p-4">
            <p className="text-sm font-black">Own a business?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reach thousands of local customers with limited-time offers on YAJ Deals.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  toast.error("Sign in to become a business");
                  nav("/auth");
                  return;
                }
                nav("/deals/become-business");
              }}
              className="mt-3 h-10 w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-black text-white"
            >
              Become a Business
            </button>
          </section>
        ) : null}
      </main>

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
  fillViewport,
  onExpand,
  onOnline,
  onBecomeBusiness,
  isDealBusiness,
}: {
  q: string;
  filter: string;
  fillViewport?: boolean;
  onExpand: () => void;
  onOnline: () => void;
  onBecomeBusiness: () => void;
  isDealBusiness: boolean;
}) {
  if (q) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-bold">No matches for “{q}”</p>
        <p className="mt-1 text-sm text-muted-foreground">Try another keyword, category, or city.</p>
      </div>
    );
  }

  const shellClass = fillViewport
    ? "relative min-h-0 w-full flex-1 overflow-hidden rounded-[1.5rem] bg-muted shadow-[0_22px_48px_-24px_rgba(15,23,42,0.6)] ring-1 ring-black/5"
    : "relative w-full overflow-hidden rounded-[1.5rem] bg-muted shadow-[0_22px_48px_-24px_rgba(15,23,42,0.6)] ring-1 ring-black/5 aspect-[4/5]";

  if (filter === "near-me") {
    return (
      <div className={shellClass}>
        <img
          src={lifestyleDining}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
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
    );
  }

  // Hero sits on top of the bottom nav — fills leftover viewport when empty
  return (
    <div className={shellClass}>
      <img
        src={emptyHero}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/30 bg-white/18 p-4 text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <p className="text-lg font-black tracking-tight">🎉 Local Deals Start Here</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/90">
          Discover discounts from restaurants, shops, salons, gyms, and local businesses near you.
        </p>
        {!isDealBusiness ? (
          <>
            <p className="mt-2 text-[11px] font-semibold text-amber-100">Own a business? Reach local customers.</p>
            <button
              type="button"
              onClick={onBecomeBusiness}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-sm font-black text-white shadow-[0_12px_24px_-12px_rgba(234,88,12,0.95)]"
            >
              Become a Business
            </button>
          </>
        ) : (
          <p className="mt-2 text-[11px] font-semibold text-amber-100">
            Post your first offer from your Business Dashboard in Profile.
          </p>
        )}
      </div>
    </div>
  );
}
