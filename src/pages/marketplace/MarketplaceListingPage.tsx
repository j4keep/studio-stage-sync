import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  approxLocation,
  formatPrice,
  getCategory,
  sanitizeDescription,
  timeAgo,
} from "@/lib/marketplace";
import {
  createOffer,
  getMarketplaceListing,
  listMarketplaceListings,
  toggleSaveListing,
  updateMarketplaceListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";
import ListingCard from "@/components/marketplace/ListingCard";
import MarketplaceNav from "@/components/marketplace/MarketplaceNav";

export default function MarketplaceListingPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [more, setMore] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmt, setOfferAmt] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getMarketplaceListing(id, user?.id);
      setListing(row);
      if (row) {
        const others = await listMarketplaceListings({
          sellerId: row.seller_id,
          viewerId: user?.id,
          status: ["active", "pending"],
          limit: 8,
        });
        setMore(others.filter((l) => l.id !== row.id));
        setOfferAmt(row.price != null ? String(Math.max(0, Math.floor(Number(row.price) * 0.9))) : "");
      }
    } catch (e: any) {
      toast.error(e?.message || "Listing not found");
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = useMemo(() => {
    if (!listing) return [];
    const fromMedia = (listing.media || [])
      .map((m) => m.url)
      .filter(Boolean);
    if (fromMedia.length) return fromMedia;
    return listing.cover_url ? [listing.cover_url] : [];
  }, [listing]);

  const isOwner = user?.id === listing?.seller_id;
  const cat = getCategory(listing?.category);

  const onSave = async () => {
    if (!user || !listing) return toast.error("Sign in to save");
    const next = !listing.saved;
    setListing({ ...listing, saved: next });
    try {
      await toggleSaveListing(user.id, listing.id, next);
    } catch {
      setListing({ ...listing, saved: !next });
    }
  };

  const messageSeller = () => {
    if (!user || !listing) return toast.error("Sign in to message");
    if (isOwner) return toast.message("This is your listing");
    nav("/messages", {
      state: {
        startWithUserId: listing.seller_id,
        startWithProfile: {
          user_id: listing.seller_id,
          display_name: listing.seller?.display_name || "Seller",
          avatar_url: listing.seller?.avatar_url || null,
        },
        hideOtherYajPage: true,
        openMarketplaceProfile: true,
        introMessage: `Hi — interested in your Marketplace listing: ${listing.title} (${formatPrice(listing.price, listing.listing_type)})`,
      },
    });
  };

  const submitOffer = async () => {
    if (!user || !listing) return;
    const amount = Number(offerAmt);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid offer");
    setBusy(true);
    try {
      await createOffer({
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.seller_id,
        amount,
        message: offerMsg,
      });
      toast.success("Offer sent");
      setOfferOpen(false);
      messageSeller();
    } catch (e: any) {
      toast.error(e?.message || "Could not send offer");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!user || !listing || !isOwner) return;
    try {
      const updated = await updateMarketplaceListing(listing.id, user.id, { status });
      setListing(updated);
      toast.success(`Marked ${status}`);
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <div className="aspect-[4/3] animate-pulse bg-muted" />
        <div className="space-y-3 p-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 pb-28 text-center">
        <p className="font-black">Listing not found</p>
        <button type="button" onClick={() => nav("/marketplace")} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const desc = sanitizeDescription(listing.description);

  return (
    <div className="min-h-screen bg-background pb-36 text-foreground">
      <div className="relative">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => images.length && setLightbox(true)} className="block w-full">
          <div className="aspect-[4/3] bg-muted">
            {images[imgIdx] ? (
              <img
                src={images[imgIdx]}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl opacity-40">✦</div>
            )}
          </div>
        </button>
        <div className="absolute bottom-3 left-3 z-10 rounded-full bg-primary px-3.5 py-1.5 text-base font-black text-primary-foreground shadow-md">
          {formatPrice(listing.price, listing.listing_type)}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-14 left-0 right-0 z-10 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === imgIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
        {images.length > 0 && (
          <span className="absolute bottom-3 right-3 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
            {imgIdx + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2">
          {images.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setImgIdx(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? "border-primary" : "border-transparent"}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 px-4 pt-2">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xl font-black">{formatPrice(listing.price, listing.listing_type)}</p>
            {(listing.status === "sold" || listing.status === "pending") && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white ${listing.status === "sold" ? "bg-foreground" : "bg-amber-500"}`}>
                {listing.status}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-lg font-bold leading-snug">{listing.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {approxLocation(listing.city, listing.state, listing.location_approx)} · {timeAgo(listing.created_at)}
          </p>
          {listing.promoted && (
            <span className="mt-2 inline-block rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">Promoted</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => nav(`/marketplace/profile/${listing.seller_id}`)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left"
        >
          <div className="h-11 w-11 overflow-hidden rounded-full bg-muted">
            {listing.seller?.avatar_url ? (
              <img src={listing.seller.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-primary">
                {(listing.seller?.display_name || "?")[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{listing.seller?.display_name || "Seller"}</p>
            <p className="text-[11px] text-muted-foreground">
              Marketplace profile · {listing.seller?.is_business ? "Business" : "Private seller"}
            </p>
          </div>
        </button>

        <section>
          <h2 className="text-sm font-black">Details</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {listing.condition && (
              <>
                <dt className="text-muted-foreground">Condition</dt>
                <dd className="font-semibold">{listing.condition}</dd>
              </>
            )}
            {cat && (
              <>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-semibold">{cat.label}</dd>
              </>
            )}
            {listing.brand && (
              <>
                <dt className="text-muted-foreground">Brand</dt>
                <dd className="font-semibold">{listing.brand}</dd>
              </>
            )}
            {listing.vehicle?.year && (
              <>
                <dt className="text-muted-foreground">Year</dt>
                <dd className="font-semibold">{listing.vehicle.year}</dd>
              </>
            )}
            {listing.vehicle?.make && (
              <>
                <dt className="text-muted-foreground">Make</dt>
                <dd className="font-semibold">{listing.vehicle.make}</dd>
              </>
            )}
            {listing.vehicle?.model && (
              <>
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-semibold">{listing.vehicle.model}</dd>
              </>
            )}
            {listing.vehicle?.mileage != null && (
              <>
                <dt className="text-muted-foreground">Mileage</dt>
                <dd className="font-semibold">{listing.vehicle.mileage.toLocaleString()} mi</dd>
              </>
            )}
            {listing.vehicle?.vin && (
              <>
                <dt className="text-muted-foreground">VIN</dt>
                <dd className="font-semibold">{listing.vehicle.vin}</dd>
              </>
            )}
            {listing.vehicle?.transmission && (
              <>
                <dt className="text-muted-foreground">Transmission</dt>
                <dd className="font-semibold">{listing.vehicle.transmission}</dd>
              </>
            )}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {[listing.local_pickup && "Local pickup", listing.delivery && "Delivery", listing.shipping && "Shipping"]
              .filter(Boolean)
              .join(" · ") || "Local pickup"}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-black">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{desc || "No description."}</p>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-black">Location</h2>
          <p className="text-sm text-muted-foreground">
            {approxLocation(listing.city, listing.state, listing.location_approx)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Exact address is private. Meetup details can be shared in Marketplace chat.
          </p>
          {(listing.attributes as any)?.public_exact_location && listing.lat != null && listing.lng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Directions
            </a>
          )}
        </section>

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => nav(`/marketplace/edit/${listing.id}`)} className="rounded-full bg-muted px-3 py-2 text-xs font-bold">
              Edit
            </button>
            <button type="button" onClick={() => void setStatus("pending")} className="rounded-full bg-muted px-3 py-2 text-xs font-bold">
              Mark pending
            </button>
            <button type="button" onClick={() => void setStatus("sold")} className="rounded-full bg-muted px-3 py-2 text-xs font-bold">
              Mark sold
            </button>
            <button type="button" onClick={() => void setStatus("active")} className="rounded-full bg-muted px-3 py-2 text-xs font-bold">
              Reactivate
            </button>
          </div>
        )}

        {more.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black">More from this seller</h2>
              <button
                type="button"
                onClick={() => nav(`/marketplace/profile/${listing.seller_id}`)}
                className="text-xs font-bold text-primary"
              >
                View all listings
              </button>
            </div>
            <div className="space-y-2.5">
              {more.slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky actions */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-3 py-3 backdrop-blur safe-area-bottom lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:px-4">
          <div className="mx-auto flex max-w-lg gap-2">
            <button type="button" onClick={onSave} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted" aria-label="Save">
              <Heart className={`h-5 w-5 ${listing.saved ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href);
                toast.success("Link copied");
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => toast.message("Report submitted for review")} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted" aria-label="Report">
              <Flag className="h-5 w-5" />
            </button>
            {listing.open_to_offers && (
              <button
                type="button"
                onClick={() => setOfferOpen(true)}
                className="h-11 flex-1 rounded-full border border-border bg-card text-sm font-bold"
              >
                Make Offer
              </button>
            )}
            <button
              type="button"
              onClick={messageSeller}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black">
          <div className="flex items-center justify-between px-3 py-3 text-white">
            <span className="text-sm font-bold">
              {imgIdx + 1} / {images.length}
            </span>
            <button type="button" onClick={() => setLightbox(false)} className="rounded-full bg-white/15 p-2">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <img
              src={images[imgIdx]}
              alt=""
              className="max-h-full max-w-full object-contain"
              onClick={() => setImgIdx((i) => (i + 1) % images.length)}
            />
          </div>
        </div>
      )}

      {offerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/50 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-t-3xl bg-background p-5 sm:rounded-3xl">
            <h3 className="text-lg font-black">Make an offer</h3>
            <p className="mt-1 text-xs text-muted-foreground">Listed at {formatPrice(listing.price, listing.listing_type)}</p>
            <label className="mt-4 block text-xs font-bold">Your offer ($)</label>
            <input
              value={offerAmt}
              onChange={(e) => setOfferAmt(e.target.value)}
              type="number"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
            />
            <label className="mt-3 block text-xs font-bold">Message (optional)</label>
            <textarea
              value={offerMsg}
              onChange={(e) => setOfferMsg(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOfferOpen(false)} className="h-11 flex-1 rounded-full bg-muted text-sm font-bold">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitOffer()}
                className="h-11 flex-1 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && <MarketplaceNav />}
    </div>
  );
}
