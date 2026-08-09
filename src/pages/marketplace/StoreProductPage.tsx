import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, MessageCircle, ShoppingCart, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import { getMarketplaceListing, listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";
import { listMyOpenCarts, setCartItem, type MarketplaceCart } from "@/lib/marketplace-cart";

/** Amazon-style product detail for the $1–$5 store. */
export default function StoreProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [carts, setCarts] = useState<MarketplaceCart[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const row = await getMarketplaceListing(id, user?.id);
      setListing(row);
      if (user) setCarts(await listMyOpenCarts(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not load this item");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const cartCount = useMemo(
    () => carts.reduce((s, c) => s + c.items.reduce((n, i) => n + i.qty, 0), 0),
    [carts],
  );
  const inCart = useMemo(
    () => carts.flatMap((c) => c.items).find((i) => i.listing_id === id)?.qty || 0,
    [carts, id],
  );

  const stock = Number(listing?.quantity ?? 0);
  const photos = useMemo(() => {
    if (!listing) return [] as string[];
    const urls = (listing.media || []).map((m) => m.url).filter(Boolean) as string[];
    const cover = listingCoverUrl(listing);
    return urls.length ? urls : cover ? [cover] : [];
  }, [listing]);

  const add = async (buyNow: boolean) => {
    if (!listing) return;
    if (!user) return nav("/auth");
    if (listing.seller_id === user.id) return toast.error("This is your own listing");
    if (qty > stock) return toast.error(`Only ${stock} in stock`);
    setBusy(true);
    try {
      await setCartItem(listing.id, Math.max(1, inCart ? qty : qty));
      if (buyNow) nav("/marketplace/cart");
      else {
        setCarts(await listMyOpenCarts(user.id));
        toast.success("Added to cart");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not add to cart");
    } finally {
      setBusy(false);
    }
  };

  const message = () => {
    if (!listing) return;
    if (!user) return nav("/auth");
    nav("/messages", {
      state: {
        startWithUserId: listing.seller_id,
        startWithProfile: {
          user_id: listing.seller_id,
          display_name: listing.seller?.display_name ?? null,
          avatar_url: listing.seller?.avatar_url ?? null,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 pt-16">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
        <p className="font-black">Item not found</p>
        <button type="button" onClick={() => nav("/marketplace/five-under")} className="text-sm font-bold text-primary">
          Back to the store
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/marketplace/five-under")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{listing.title}</p>
        <button
          type="button"
          onClick={() => nav("/marketplace/cart")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Cart"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      <div className="px-4 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">$1–$5 Store</p>
        <h1 className="mt-1 text-[19px] font-black leading-snug">{listing.title}</h1>
        <button
          type="button"
          onClick={() => nav(`/marketplace/profile/${listing.seller_id}`)}
          className="mt-1 text-[13px] font-semibold text-primary"
        >
          Visit the {listing.seller?.display_name || "seller"}'s store
        </button>
        <div className="mt-1 flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
          ))}
          <span className="ml-1 text-[12px] font-semibold text-muted-foreground">
            {listing.views_count} views
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black">{formatPrice(listing.price, listing.listing_type)}</span>
          <span className="text-[12px] text-muted-foreground">each</span>
        </div>

        {photos.length > 0 && (
          <div className="mt-3">
            <div className="overflow-hidden rounded-2xl bg-muted">
              <img src={photos[photo]} alt={listing.title} className="h-72 w-full object-contain" />
            </div>
            {photos.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {photos.map((u, i) => (
                  <button
                    key={u + i}
                    type="button"
                    onClick={() => setPhoto(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${
                      i === photo ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className={`mt-4 text-sm font-black ${stock > 0 ? "text-emerald-600" : "text-red-500"}`}>
          {stock > 0 ? `In stock · ${stock} available` : "Out of stock"}
        </p>

        {stock > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Quantity
            </label>
            <div className="relative w-32">
              <select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-muted px-3 pr-9 text-sm font-bold"
              >
                {Array.from({ length: Math.min(stock, 30) }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Qty: {i + 1}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            </div>
            <p className="mt-2 text-sm font-bold">
              Order total: {formatPrice(Number(listing.price || 0) * qty)}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-1.5 rounded-2xl border border-border bg-card p-3 text-[13px]">
          {listing.local_pickup && <p className="font-semibold">Pickup available</p>}
          {listing.delivery && (
            <p className="flex items-center gap-1.5 font-semibold">
              <Truck className="h-4 w-4 text-primary" />
              Seller delivery ·{" "}
              {Number(listing.delivery_fee) > 0 ? `${formatPrice(listing.delivery_fee)} fee` : "Free"}
            </p>
          )}
          <p className="text-muted-foreground">
            Buy here, then arrange pickup, delivery or shipping with the seller in Messages.
          </p>
        </div>

        {listing.description && (
          <div className="mt-4">
            <h2 className="text-sm font-black">About this item</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{listing.description}</p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={message}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-label="Message seller"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={busy || stock === 0}
            onClick={() => void add(false)}
            className="h-12 flex-1 rounded-full border border-primary bg-primary/10 text-sm font-black text-primary disabled:opacity-50"
          >
            Add to cart
          </button>
          <button
            type="button"
            disabled={busy || stock === 0}
            onClick={() => void add(true)}
            className="h-12 flex-1 rounded-full bg-primary text-sm font-black text-primary-foreground disabled:opacity-50"
          >
            Buy now
          </button>
        </div>
      </div>
    </div>
  );
}
