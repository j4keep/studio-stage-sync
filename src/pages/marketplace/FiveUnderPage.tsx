import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FIVE_UNDER_MAX, formatPrice, isFiveUnderListing } from "@/lib/marketplace";
import { listMarketplaceListings, listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";
import { listMyOpenCarts, setCartItem, type MarketplaceCart } from "@/lib/marketplace-cart";

export default function FiveUnderPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<MarketplaceListing[]>([]);
  const [carts, setCarts] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listings = await listMarketplaceListings({ viewerId: user?.id, limit: 60, maxPrice: FIVE_UNDER_MAX });
      setRows(listings.filter(isFiveUnderListing));
      if (user) setCarts(await listMyOpenCarts(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not load $1–$5 Finds");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const qtyByListing = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of carts) for (const i of c.items) map.set(i.listing_id, i.qty);
    return map;
  }, [carts]);

  const cartCount = useMemo(
    () => carts.reduce((s, c) => s + c.items.reduce((n, i) => n + i.qty, 0), 0),
    [carts],
  );

  const changeQty = async (listing: MarketplaceListing, next: number) => {
    if (!user) return toast.error("Sign in to add to cart");
    if (listing.seller_id === user.id) return toast.error("This is your own listing");
    const stock = Number(listing.quantity ?? 0);
    if (next > stock) return toast.error(`Only ${stock} in stock`);
    setPending(listing.id);
    try {
      await setCartItem(listing.id, Math.max(0, next));
      setCarts(await listMyOpenCarts(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not update cart");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/marketplace")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black leading-tight">$1–$5 Finds</h1>
            <p className="text-[11px] text-muted-foreground">Everything five dollars or less · add to cart</p>
          </div>
          <button
            type="button"
            onClick={() => nav("/marketplace/cart")}
            className="relative flex h-10 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground"
          >
            <ShoppingCart className="h-4 w-4" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-black text-background">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="px-3 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <p className="font-bold">No $1–$5 Finds yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Post something for five dollars or less.</p>
            <button
              type="button"
              onClick={() => nav("/marketplace/create")}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Post a $1–$5 Find
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rows.map((l) => {
              const qty = qtyByListing.get(l.id) || 0;
              const stock = Number(l.quantity ?? 0);
              return (
                <div key={l.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => nav(`/marketplace/listing/${l.id}`)}
                    className="block aspect-square w-full bg-muted"
                  >
                    {listingCoverUrl(l) ? (
                      <img src={listingCoverUrl(l) as string} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl opacity-40">·</span>
                    )}
                  </button>
                  <div className="space-y-1 p-2.5">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{l.title}</p>
                    <p className="text-[13px] font-black">{formatPrice(l.price, l.listing_type)}</p>
                    <p className={`text-[11px] ${stock > 0 ? "text-muted-foreground" : "text-red-500"}`}>
                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    </p>
                    {stock > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        {qty > 0 ? (
                          <div className="flex w-full items-center justify-between rounded-full bg-muted px-1 py-1">
                            <button
                              type="button"
                              disabled={pending === l.id}
                              onClick={() => void changeQty(l, qty - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-background"
                              aria-label="Remove one"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-sm font-black">{qty}</span>
                            <button
                              type="button"
                              disabled={pending === l.id || qty >= stock}
                              onClick={() => void changeQty(l, qty + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-background disabled:opacity-40"
                              aria-label="Add one"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={pending === l.id}
                            onClick={() => void changeQty(l, 1)}
                            className="h-9 w-full rounded-full bg-primary text-xs font-bold text-primary-foreground disabled:opacity-60"
                          >
                            Add to cart
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
