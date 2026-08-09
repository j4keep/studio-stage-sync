import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FIVE_UNDER_MAX, FIVE_UNDER_MIN, formatPrice } from "@/lib/marketplace";
import { listMarketplaceListings, listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";
import { listMyOpenCarts, setCartItem, type MarketplaceCart } from "@/lib/marketplace-cart";

const SORTS = [
  { id: "new", label: "Newest" },
  { id: "low", label: "Price: low" },
  { id: "high", label: "Price: high" },
] as const;

/** Storefront view for $1–$5 Finds — compact product tiles, cart, product pages. */
export default function FiveUnderPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<MarketplaceListing[]>([]);
  const [carts, setCarts] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("new");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listings = await listMarketplaceListings({
        viewerId: user?.id,
        limit: 60,
        listingType: "five_under",
        minPrice: FIVE_UNDER_MIN,
        maxPrice: FIVE_UNDER_MAX,
      });
      setRows(listings);
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

  const cartCount = useMemo(
    () => carts.reduce((s, c) => s + c.items.reduce((n, i) => n + i.qty, 0), 0),
    [carts],
  );
  const cartTotal = useMemo(() => carts.reduce((s, c) => s + c.subtotal, 0), [carts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) out = out.filter((l) => `${l.title} ${l.description}`.toLowerCase().includes(q));
    if (sort === "low") out = [...out].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === "high") out = [...out].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return out;
  }, [rows, query, sort]);

  const stores = useMemo(() => {
    const map = new Map<
      string,
      { sellerId: string; name: string; tagline: string | null; banner: string | null; items: MarketplaceListing[] }
    >();
    for (const l of visible) {
      const key = l.seller_id;
      if (!map.has(key)) {
        map.set(key, {
          sellerId: key,
          name: l.seller?.store_name || l.seller?.display_name || "Store",
          tagline: l.seller?.store_tagline || null,
          banner: l.seller?.store_banner_url || null,
          items: [],
        });
      }
      map.get(key)!.items.push(l);
    }
    return [...map.values()];
  }, [visible]);

  const addOne = async (listing: MarketplaceListing) => {
    if (!user) return nav("/auth");
    if (listing.seller_id === user.id) return toast.error("This is your own listing");
    const stock = Number(listing.quantity ?? 0);
    const current = carts.flatMap((c) => c.items).find((i) => i.listing_id === listing.id)?.qty || 0;
    if (current + 1 > stock) return toast.error(`Only ${stock} in stock`);
    setPending(listing.id);
    try {
      await setCartItem(listing.id, current + 1);
      setCarts(await listMyOpenCarts(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not update cart");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 space-y-2.5 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/marketplace")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the $1–$5 store"
              className="h-10 w-full rounded-full border border-border bg-muted pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => nav("/marketplace/cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Cart"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${
                sort === s.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => nav("/marketplace/create?type=five_under")}
            className="ml-auto shrink-0 rounded-full border border-primary px-3 py-1.5 text-[12px] font-black text-primary"
          >
            Sell an item
          </button>
        </div>
      </header>

      <div className="px-3 pt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <p className="font-bold">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Post something for five dollars or less.</p>
            <button
              type="button"
              onClick={() => nav("/marketplace/create?type=five_under")}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Post a $1–$5 Find
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {visible.map((l) => {
              const stock = Number(l.quantity ?? 0);
              const cover = listingCoverUrl(l);
              return (
                <article key={l.id} className="flex flex-col rounded-xl border border-border bg-card p-2.5">
                  <button
                    type="button"
                    onClick={() => nav(`/marketplace/product/${l.id}`)}
                    className="text-left"
                  >
                    <h2 className="line-clamp-2 min-h-[2.4rem] text-[12.5px] font-semibold leading-snug">
                      {l.title}
                    </h2>
                    <div className="mt-1.5 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-background">
                      {cover ? (
                        <img src={cover} alt={l.title} className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <span className="text-2xl opacity-30">·</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[15px] font-black">{formatPrice(l.price, l.listing_type)}</p>
                    <p className={`text-[11px] ${stock > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    </p>
                    {l.delivery && (
                      <p className="text-[11px] text-muted-foreground">
                        {Number(l.delivery_fee) > 0 ? `+ ${formatPrice(l.delivery_fee)} delivery` : "Free delivery"}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pending === l.id || stock === 0}
                    onClick={() => void addOne(l)}
                    className="mt-2 h-8 w-full rounded-full bg-primary text-[12px] font-black text-primary-foreground disabled:opacity-50"
                  >
                    Add to cart
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => nav("/marketplace/cart")}
          className="fixed inset-x-3 bottom-24 z-30 flex h-12 items-center justify-between rounded-full bg-foreground px-5 text-background shadow-lg"
        >
          <span className="text-sm font-black">
            {cartCount} item{cartCount === 1 ? "" : "s"} in cart
          </span>
          <span className="text-sm font-black">{formatPrice(cartTotal)} · Checkout</span>
        </button>
      )}
    </div>
  );
}
