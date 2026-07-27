import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listMarketplaceListings, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";

export default function MarketplaceSalesPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await listMarketplaceListings({
      sellerId: user.id,
      status: ["sold", "pending"],
      viewerId: user.id,
      limit: 40,
    });
    setListings(rows);
  }, [user]);

  useEffect(() => {
    void load().catch(() => setListings([]));
  }, [load]);

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace/account")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Sales</h1>
      </header>
      <div className="px-3 pt-3">
        {listings.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Pending and sold listings show up here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
      <MarketplaceNav />
    </div>
  );
}
