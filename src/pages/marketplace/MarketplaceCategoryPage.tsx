import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCategory } from "@/lib/marketplace";
import { listMarketplaceListings, toggleSaveListing, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";
import { toast } from "sonner";

export default function MarketplaceCategoryPage() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const cat = getCategory(slug);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMarketplaceListings({ category: slug, viewerId: user?.id, limit: 60 });
      setListings(rows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

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
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-black">
            {cat?.emoji} {cat?.label || slug}
          </h1>
          <p className="text-[11px] text-muted-foreground">{listings.length} listings</p>
        </div>
      </header>

      <div className="px-3 pt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Nothing in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} onToggleSave={onToggleSave} />
            ))}
          </div>
        )}
      </div>
      <MarketplaceNav />
    </div>
  );
}
