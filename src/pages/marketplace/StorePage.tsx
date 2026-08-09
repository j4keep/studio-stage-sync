import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, MessageCircle, ShoppingCart, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FIVE_UNDER_MAX, FIVE_UNDER_MIN, formatPrice } from "@/lib/marketplace";
import {
  getMarketplaceProfile,
  listMarketplaceListings,
  listingCoverUrl,
  type MarketplaceListing,
  type MarketplaceProfile,
} from "@/lib/marketplace-api";
import { listMyOpenCarts, setCartItem, type MarketplaceCart } from "@/lib/marketplace-cart";
import { useSellerDistance } from "@/hooks/use-seller-distance";

/** One seller's $1–$5 storefront: header, tagline, delivery terms and all of their products. */
export default function StorePage() {
  const { sellerId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState<MarketplaceProfile | null>(null);
  const [rows, setRows] = useState<MarketplaceListing[]>([]);
  const [carts, setCarts] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const [prof, listings] = await Promise.all([
        getMarketplaceProfile(sellerId),
        listMarketplaceListings({
          sellerId,
          viewerId: user?.id,
          listingType: "five_under",
          minPrice: FIVE_UNDER_MIN,
          maxPrice: FIVE_UNDER_MAX,
          limit: 100,
        }),
      ]);
      setStore(prof);
      setRows(listings);
      if (user) setCarts(await listMyOpenCarts(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not load this store");
    } finally {
      setLoading(false);
    }
  }, [sellerId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const cartCount = useMemo(
    () => carts.reduce((s, c) => s + c.items.reduce((n, i) => n + i.qty, 0), 0),
    [carts],
  );

  const storeName = store?.store_name || store?.display_name || "Store";
  const perMile = Number(store?.delivery_per_mile || 0);
  const { away } = useSellerDistance(sellerId);

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
      toast.success("Added to cart");
    } catch (e: any) {
      toast.error(e?.message || "Could not update cart");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/marketplace/five-under")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-black">{storeName}</p>
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
      </header>

      {loading ? (
        <div className="space-y-3 px-3 pt-3">
          <div className="h-36 animate-pulse rounded-2xl bg-muted" />
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : (
        <>
          <section className="overflow-hidden border-b border-border bg-card">
            <div className="h-40 w-full bg-muted">
              {store?.store_banner_url ? (
                <img
                  src={store.store_banner_url}
                  alt={`${storeName} store header`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-r from-primary/20 to-primary/5">
                  <span className="text-lg font-black tracking-tight">{storeName}</span>
                </div>
              )}
            </div>
            <div className="space-y-2 px-4 py-3">
              <h1 className="text-lg font-black leading-tight">{storeName}</h1>
              {store?.store_tagline && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {store.store_tagline}
                </p>
              )}
              {away && (
                <p className="flex items-center gap-1.5 text-[13px] font-bold">
                  <MapPin className="h-4 w-4 text-primary" />
                  {away}
                  {store?.city ? <span className="font-semibold text-muted-foreground">· {store.city}</span> : null}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                {store?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {store.city}
                  </span>
                )}
                <span>
                  {rows.length} product{rows.length === 1 ? "" : "s"}
                </span>
                {perMile > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Truck className="h-3.5 w-3.5 text-primary" /> {formatPrice(perMile)}/mile local delivery
                    {Number(store?.delivery_max_miles || 0) > 0
                      ? ` · up to ${Number(store?.delivery_max_miles)} mi`
                      : ""}
                  </span>
                )}
              </div>
              {user && sellerId !== user.id && (
                <button
                  type="button"
                  onClick={() =>
                    nav("/messages", {
                      state: {
                        startWithUserId: sellerId,
                        startWithProfile: {
                          user_id: sellerId,
                          display_name: store?.display_name ?? null,
                          avatar_url: store?.avatar_url ?? null,
                        },
                      },
                    })
                  }
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border text-xs font-bold"
                >
                  <MessageCircle className="h-4 w-4" /> Message this store
                </button>
              )}
            </div>
          </section>

          <div className="px-3 pt-3">
            {rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                This store has no $1–$5 products right now.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {rows.map((l) => {
                  const stock = Number(l.quantity ?? 0);
                  const cover = listingCoverUrl(l);
                  return (
                    <article key={l.id} className="flex flex-col rounded-xl border border-border bg-card p-2.5">
                      <button type="button" onClick={() => nav(`/marketplace/product/${l.id}`)} className="text-left">
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
        </>
      )}
    </div>
  );
}
