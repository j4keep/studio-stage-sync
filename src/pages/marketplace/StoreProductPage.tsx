import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, MapPin, MessageCircle, Share2, ShoppingCart, Star, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import {
  getMarketplaceListing,
  getMarketplaceProfile,
  listingCoverUrl,
  type MarketplaceListing,
  type MarketplaceProfile,
} from "@/lib/marketplace-api";
import { listMyOpenCarts, setCartItem, type MarketplaceCart } from "@/lib/marketplace-cart";
import { useMyMarketplaceLocation } from "@/hooks/use-marketplace-location";
import { getDeliveryQuoteAt, milesAwayLabel, type DeliveryQuote } from "@/lib/marketplace-delivery";
import MarketplaceLocationCard from "@/components/marketplace/MarketplaceLocationCard";
import MarketplaceLocationGate from "@/components/marketplace/MarketplaceLocationGate";
import ShareListingSheet from "@/components/marketplace/ShareListingSheet";
import StoreRatingStars from "@/components/marketplace/StoreRatingStars";
import StoreReviewsSection from "@/components/marketplace/StoreReviewsSection";
import { fetchStoreRating } from "@/lib/store-reviews";
import { resolveDisplayRating, type DisplayRating } from "@/lib/ratings";


const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);


/** Amazon-style product detail for the $1–$5 store. */
export default function StoreProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [store, setStore] = useState<MarketplaceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [carts, setCarts] = useState<MarketplaceCart[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [storeRating, setStoreRating] = useState<DisplayRating>(resolveDisplayRating(null, 0));
  const stripRef = useRef<HTMLDivElement | null>(null);


  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const row = await getMarketplaceListing(id, user?.id);
      setListing(row);
      if (row?.seller_id) {
        setStore(await getMarketplaceProfile(row.seller_id).catch(() => null));
        setStoreRating(await fetchStoreRating(row.seller_id).catch(() => resolveDisplayRating(null, 0)));
      }

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
  const perMile = Number(store?.delivery_per_mile || 0);
  const minFee = Number(store?.delivery_min_fee || 0);
  const maxMiles = Number(store?.delivery_max_miles || 0);

  const { location, ready: locationReady } = useMyMarketplaceLocation(user?.id);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [wantDelivery, setWantDelivery] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

  // Distance + delivery price fill in on their own once the shopper's location is on.
  useEffect(() => {
    if (!listing?.seller_id || !locationReady || location.lat == null || location.lng == null) {
      setQuote(null);
      return;
    }
    let alive = true;
    void getDeliveryQuoteAt(listing.seller_id, location.lat, location.lng, location.address || undefined)
      .then((q) => alive && setQuote(q))
      .catch(() => alive && setQuote(null));
    return () => {
      alive = false;
    };
  }, [listing?.seller_id, locationReady, location.lat, location.lng, location.address]);

  const away = milesAwayLabel(quote?.miles);
  const photos = useMemo(() => {
    if (!listing) return [] as string[];
    const urls = (listing.media || []).map((m) => m.url).filter(Boolean) as string[];
    const cover = listingCoverUrl(listing);
    const list = urls.length ? urls : cover ? [cover] : [];
    // Photos first, video last — shoppers see the product before the clip plays.
    return [...list].sort((a, b) => Number(isVideoUrl(a)) - Number(isVideoUrl(b)));
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
    <MarketplaceLocationGate>
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
          onClick={() => setShareOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
        </button>
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
          onClick={() => nav(`/marketplace/store/${listing.seller_id}`)}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[12.5px] font-black"
        >
          <Store className="h-3.5 w-3.5 text-primary" />
          View store
          <span className="font-semibold text-muted-foreground">
            · {listing.seller?.store_name || listing.seller?.display_name || "Seller"}
          </span>
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
        {away && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Nearby · {away}
          </p>
        )}


        {photos.length > 0 && (
          <div className="mt-3">
            <div
              ref={stripRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                setPhoto(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
              }}
              className="flex snap-x snap-mandatory gap-0 overflow-x-auto rounded-2xl bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((u, i) =>
                isVideoUrl(u) ? (
                  <video
                    key={u + i}
                    src={u}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-72 w-full shrink-0 snap-center bg-black object-contain"
                  />
                ) : (
                  <img
                    key={u + i}
                    src={u}
                    alt={`${listing.title} photo ${i + 1}`}
                    className="h-72 w-full shrink-0 snap-center object-contain"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ),
              )}
            </div>
            {photos.length > 1 && (
              <>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {photos.map((u, i) => (
                    <span
                      key={`dot-${u}-${i}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === photo ? "w-5 bg-primary" : "w-1.5 bg-border"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {photos.map((u, i) => (
                    <button
                      key={u + i}
                      type="button"
                      onClick={() => {
                        const el = stripRef.current;
                        if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                        setPhoto(i);
                      }}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${
                        i === photo ? "border-primary" : "border-border"
                      }`}
                    >
                      {isVideoUrl(u) ? (
                        <span className="flex h-full w-full items-center justify-center bg-black text-[10px] font-black text-white">
                          ▶ Video
                        </span>
                      ) : (
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              </>
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

        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3 text-[13px]">
          {listing.local_pickup && <p className="font-semibold">Pickup available</p>}

          {listing.delivery && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Truck className="h-4 w-4 text-primary" />
                  Delivery
                  {quote?.perMile ? (
                    <span className="text-muted-foreground">· {formatPrice(quote.perMile)}/mile</span>
                  ) : perMile > 0 ? (
                    <span className="text-muted-foreground">· {formatPrice(perMile)}/mile</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const next = !wantDelivery;
                    setWantDelivery(next);
                    if (next && !locationReady) setShowLocation(true);
                  }}
                  aria-label="Delivery"
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    wantDelivery ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition-all ${
                      wantDelivery ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {wantDelivery && (
                <>
                  {quote?.configured && quote.fee != null ? (
                    quote.tooFar ? (
                      <p className="font-bold text-red-500">
                        Too far — this seller delivers up to {quote.maxMiles} mi. Pick pickup instead.
                      </p>
                    ) : (
                      <>
                        <p className="font-black text-emerald-600">
                          Delivery {formatPrice(quote.fee)} · {quote.miles} mi
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">
                          Total with delivery: {formatPrice(Number(listing.price || 0) * qty + quote.fee)}
                          {quote.estimated ? " · estimated at $1/mile" : ""}
                        </p>
                      </>
                    )
                  ) : locationReady ? (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pricing your delivery…
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Turn on your location to see the price.</p>
                  )}
                </>
              )}
            </>
          )}

          {user && (showLocation || !locationReady) && (
            <div className="pt-1">
              <MarketplaceLocationCard userId={user.id} title="Your delivery location" />
            </div>
          )}
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
      {shareOpen && (
        <ShareListingSheet
          listing={listing}
          storeName={store?.store_name || listing.seller?.store_name || null}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
    </MarketplaceLocationGate>
  );
}
