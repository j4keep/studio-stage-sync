import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listSavedListings, toggleSaveListing, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard, { ListingCardSkeleton } from "@/components/marketplace/ListingCard";

export default function MarketplaceSavedPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setListings(await listSavedListings(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load saved");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleSave = async (listing: MarketplaceListing) => {
    if (!user) return;
    setListings((prev) => prev.filter((l) => l.id !== listing.id));
    try {
      await toggleSaveListing(user.id, listing.id, false);
    } catch {
      void load();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace/account")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">Saved</h1>
      </header>
      <div className="px-3 pt-3">
        {!user ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Sign in to see saved listings.</p>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No saved listings yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={{ ...l, saved: true }} onToggleSave={onToggleSave} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
