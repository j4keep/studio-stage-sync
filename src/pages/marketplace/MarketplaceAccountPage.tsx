import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Heart, Package, Receipt, Settings, Shield, ShoppingBag, Store, Tag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listMarketplaceListings, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard from "@/components/marketplace/ListingCard";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";

/** Simple My Listings / saved management — not a Marketplace dashboard. */
export default function MarketplaceAccountPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mine, setMine] = useState<MarketplaceListing[]>([]);
  const [filter, setFilter] = useState<"active" | "draft" | "pending" | "sold">("active");

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await listMarketplaceListings({
      sellerId: user.id,
      status: filter,
      viewerId: user.id,
      limit: 40,
    });
    setMine(rows);
  }, [user, filter]);

  useEffect(() => {
    void load().catch(() => setMine([]));
  }, [load]);

  const links = [
    { label: "$1–$5 Store dashboard", icon: Store, to: "/marketplace/store-dashboard" },
    { label: "My purchases", icon: ShoppingBag, to: "/marketplace/purchases" },
    { label: "Receipts", icon: Receipt, to: "/marketplace/receipts" },
    { label: "Saved items", icon: Heart, to: "/marketplace/saved" },
    { label: "Offers", icon: Package, to: "/marketplace/offers" },
    { label: "Sales", icon: Tag, to: "/marketplace/sales" },
    { label: "Settings", icon: Settings, to: "/marketplace/settings" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-lg font-bold">My Listings</h1>
        {user && (
          <button type="button" onClick={() => nav(`/marketplace/profile/${user.id}`)} className="text-xs font-semibold text-primary">
            Seller view
          </button>
        )}
      </header>

      <div className="space-y-0.5 px-2 pt-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.to}
              type="button"
              onClick={() => nav(l.to)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold">{l.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <section className="mt-4 px-3">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {(["active", "draft", "pending", "sold"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                filter === f ? "border-foreground bg-foreground text-background" : "border-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {mine.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No {filter} listings.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mine.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
