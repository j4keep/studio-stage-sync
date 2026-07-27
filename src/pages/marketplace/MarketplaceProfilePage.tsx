import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  ensureMarketplaceProfile,
  getMarketplaceProfile,
  listMarketplaceListings,
  toggleSaveListing,
  updateMarketplaceProfile,
  type MarketplaceListing,
  type MarketplaceProfile,
} from "@/lib/marketplace-api";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";

export default function MarketplaceProfilePage() {
  const { userId = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isSelf = user?.id === userId;

  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [active, setActive] = useState<MarketplaceListing[]>([]);
  const [sold, setSold] = useState<MarketplaceListing[]>([]);
  const [tab, setTab] = useState<"active" | "sold">("active");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isSelf && user) await ensureMarketplaceProfile(user.id);
      const p = await getMarketplaceProfile(userId);
      setProfile(p);
      setBio(p?.bio || "");
      setDisplayName(p?.display_name || "");
      setCity(p?.city || "");
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
    } catch (e: any) {
      toast.error(e?.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [userId, user, isSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (!user || !isSelf) return;
    try {
      const updated = await updateMarketplaceProfile(user.id, {
        display_name: displayName,
        bio,
        city,
      });
      setProfile({ ...updated, member_since: updated.created_at });
      setEditing(false);
      toast.success("Marketplace profile updated");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

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
      /* revert ignored for brevity */
    }
  };

  const list = tab === "active" ? active : sold;
  const since = profile?.member_since || profile?.created_at;

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-lg font-black">Marketplace profile</h1>
        {!isSelf && (
          <button type="button" onClick={() => toast.message("Report submitted")} className="rounded-full bg-muted p-2" aria-label="Report">
            <Flag className="h-4 w-4" />
          </button>
        )}
      </header>

      {loading || !profile ? (
        <div className="space-y-3 p-4">
          <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center px-4 pt-6 text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-black text-primary">
                  {(profile.display_name || "?")[0]}
                </div>
              )}
            </div>
            <h2 className="mt-3 text-xl font-black">{profile.display_name || "Seller"}</h2>
            {profile.is_business && (
              <span className="mt-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">Business</span>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {profile.city || profile.service_area || "Local area"}
              {since ? ` · Member since ${new Date(since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
            </p>
            <div className="mt-3 flex gap-6 text-center">
              <div>
                <p className="text-lg font-black">—</p>
                <p className="text-[10px] text-muted-foreground">Seller rating</p>
              </div>
              <div>
                <p className="text-lg font-black">—</p>
                <p className="text-[10px] text-muted-foreground">Buyer rating</p>
              </div>
              <div>
                <p className="text-lg font-black">{active.length}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="text-lg font-black">{sold.length}</p>
                <p className="text-[10px] text-muted-foreground">Sold</p>
              </div>
            </div>
            {profile.bio && !editing && <p className="mt-3 max-w-sm text-sm text-muted-foreground">{profile.bio}</p>}
            {isSelf && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-4 rounded-full bg-muted px-4 py-2 text-xs font-bold"
              >
                Edit Marketplace profile
              </button>
            )}
            {editing && (
              <div className="mt-4 w-full max-w-sm space-y-2 text-left">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Bio"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="h-10 flex-1 rounded-full bg-muted text-xs font-bold">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void saveProfile()} className="h-10 flex-1 rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    Save
                  </button>
                </div>
              </div>
            )}
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
                className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Message
              </button>
            )}
          </div>

          <div className="mt-6 flex border-b border-border px-4">
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
                className={`flex-1 border-b-2 py-2.5 text-sm font-bold ${
                  tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"
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
              <div className="grid grid-cols-2 gap-2.5">
                {list.map((l) => (
                  <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <MarketplaceNav />
    </div>
  );
}
