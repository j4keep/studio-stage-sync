import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Package,
  Settings,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ensureMarketplaceProfile, listMarketplaceListings, type MarketplaceListing } from "@/lib/marketplace-api";
import ListingCard from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";

export default function MarketplaceAccountPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mine, setMine] = useState<MarketplaceListing[]>([]);
  const [filter, setFilter] = useState<"active" | "draft" | "pending" | "sold" | "archived">("active");

  const load = useCallback(async () => {
    if (!user) return;
    await ensureMarketplaceProfile(user.id);
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
    { label: "Saved items", icon: Heart, to: "/marketplace/saved" },
    { label: "Purchases", icon: ShoppingBag, to: "/marketplace/purchases" },
    { label: "Sales", icon: Tag, to: "/marketplace/sales" },
    { label: "Offers", icon: Package, to: "/marketplace/offers" },
    { label: "Messages", icon: MessageCircle, to: "/marketplace/messages" },
    { label: "Marketplace settings", icon: Settings, to: "/marketplace/settings" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-lg font-black">My Marketplace</h1>
        {user && (
          <button
            type="button"
            onClick={() => nav(`/marketplace/profile/${user.id}`)}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            Profile
          </button>
        )}
      </header>

      <div className="space-y-1 px-4 pt-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.to}
              type="button"
              onClick={() => nav(l.to)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-semibold">{l.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <section className="mt-4 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black">My listings</h2>
          <button type="button" onClick={() => nav("/marketplace/create")} className="text-xs font-bold text-primary">
            + Sell
          </button>
        </div>
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {(["active", "draft", "pending", "sold", "archived"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {mine.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No {filter} listings.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {mine.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <MarketplaceNav />
    </div>
  );
}
