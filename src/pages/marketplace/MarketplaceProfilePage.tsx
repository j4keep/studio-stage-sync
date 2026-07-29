import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Flag, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listMarketplaceListings,
  toggleSaveListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";
import { fetchMarketplaceRoleRatings, type MarketplaceRoleRatings } from "@/lib/ratings";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import UserRatingStars from "@/components/UserRatingStars";
import UserReviewsSection from "@/components/UserReviewsSection";

type YajUser = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at?: string | null;
};

/**
 * Marketplace profile for a seller or buyer — separate from the YAJ artist page.
 * Ratings sit under the name so both sides stay accountable.
 */
export default function MarketplaceProfilePage() {
  const { userId = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isSelf = user?.id === userId;

  const [profile, setProfile] = useState<YajUser | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [ratings, setRatings] = useState<MarketplaceRoleRatings | null>(null);
  const [active, setActive] = useState<MarketplaceListing[]>([]);
  const [sold, setSold] = useState<MarketplaceListing[]>([]);
  const [tab, setTab] = useState<"active" | "sold">("active");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: yaj } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(yaj || { user_id: userId, display_name: "Member", avatar_url: null });

      const [{ data: mp }, roleRatings] = await Promise.all([
        (supabase as any)
          .from("marketplace_profiles")
          .select("city, service_area")
          .eq("user_id", userId)
          .maybeSingle(),
        fetchMarketplaceRoleRatings(userId),
      ]);
      setCity(mp?.city || mp?.service_area || null);
      setRatings(roleRatings);

      const [a, s] = await Promise.all([
        listMarketplaceListings({
          sellerId: userId,
          status: ["active", "pending"],
          viewerId: user?.id,
          limit: 40,
        }),
        listMarketplaceListings({
          sellerId: userId,
          status: "sold",
          viewerId: user?.id,
          limit: 40,
        }),
      ]);
      setActive(a);
      setSold(s);
      if (!mp?.city && !mp?.service_area && a[0]) {
        setCity([a[0].city, a[0].state].filter(Boolean).join(", ") || null);
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not load marketplace profile");
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleSave = async (listing: MarketplaceListing) => {
    if (!user) return;
    const next = !listing.saved;
    const apply = (arr: MarketplaceListing[]) =>
      arr.map((l) => (l.id === listing.id ? { ...l, saved: next } : l));
    setActive(apply);
    setSold(apply);
    try {
      await toggleSaveListing(user.id, listing.id, next);
    } catch {
      /* ignore */
    }
  };

  const list = tab === "active" ? active : sold;
  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">YAJ Marketplace</p>
          <h1 className="truncate text-base font-bold">Marketplace profile</h1>
        </div>
        {!isSelf && (
          <button
            type="button"
            onClick={() => toast.message("Report submitted")}
            className="rounded-full bg-muted p-2"
            aria-label="Report"
          >
            <Flag className="h-4 w-4" />
          </button>
        )}
      </header>

      {loading || !profile ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        </div>
      ) : (
        <>
          <section className="border-b border-border px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                    {(profile.display_name || "?")[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold leading-tight">{profile.display_name || "Member"}</h2>
                <UserRatingStars rating={ratings?.overall} variant="full" className="mt-1" />
                {(city || since) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    {city && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {city}
                      </span>
                    )}
                    {city && since ? <span>·</span> : null}
                    {since ? <span>Joined {since}</span> : null}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Seller</p>
                <UserRatingStars rating={ratings?.seller} variant="full" className="mt-1" />
                <p className="mt-1 text-[11px] text-muted-foreground">{sold.length} sold · {active.length} active</p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Buyer</p>
                <UserRatingStars rating={ratings?.buyer} variant="full" className="mt-1" />
                <p className="mt-1 text-[11px] text-muted-foreground">From marketplace deals</p>
              </div>
            </div>

            {!isSelf && (
              <button
                type="button"
                onClick={() =>
                  nav("/messages", {
                    state: {
                      startWithUserId: userId,
                      startWithProfile: {
                        user_id: userId,
                        display_name: profile.display_name,
                        avatar_url: profile.avatar_url,
                      },
                      hideOtherYajPage: true,
                      openMarketplaceProfile: true,
                      introMessage: "Hi — messaging from YAJ Marketplace",
                    },
                  })
                }
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              >
                Message
                <ChevronRight className="h-4 w-4 opacity-80" />
              </button>
            )}
            {isSelf && (
              <button
                type="button"
                onClick={() => nav("/marketplace/account")}
                className="mt-4 w-full rounded-full bg-muted py-2.5 text-sm font-semibold"
              >
                Manage my listings
              </button>
            )}
          </section>

          <div className="mt-1 flex border-b border-border px-4">
            {(
              [
                ["active", `Active (${active.length})`],
                ["sold", `Sold (${sold.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 border-b-2 py-2.5 text-sm font-semibold ${
                  tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-3 pt-3">
            {list.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No {tab} listings.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {list.map((l) => (
                  <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
                ))}
              </div>
            )}
          </div>

          <UserReviewsSection
            userId={userId}
            title="Marketplace reviews"
            emptyHint="No marketplace reviews yet — after an offer is accepted, both sides can rate each other."
          />
        </>
      )}
    </div>
  );
}
