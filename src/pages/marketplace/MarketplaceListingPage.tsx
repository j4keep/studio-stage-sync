import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Send,
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
  recordListingInquiry,
  toggleSaveListing,
  updateMarketplaceListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";
import ListingCard from "@/components/marketplace/ListingCard";
import MarkSoldSheet from "@/components/marketplace/MarkSoldSheet";
import MarketplaceMoreOptionsSheet from "@/components/marketplace/MarketplaceMoreOptionsSheet";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";
import UserRatingStars from "@/components/UserRatingStars";
import { fetchUserDisplayRating, type DisplayRating } from "@/lib/ratings";
import { blockUser } from "@/lib/blocks";
import ShareListingSheet from "@/components/marketplace/ShareListingSheet";
import MarketplaceLocationGate from "@/components/marketplace/MarketplaceLocationGate";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";
import { useSellerDistance } from "@/hooks/use-seller-distance";

export default function MarketplaceListingPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [more, setMore] = useState<MarketplaceListing[]>([]);
  const [nearby, setNearby] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmt, setOfferAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState("Hi, is this still available?");
  const [sellerRating, setSellerRating] = useState<DisplayRating | null>(null);
  const [soldSheetOpen, setSoldSheetOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const row = await getMarketplaceListing(id, user?.id);
      setListing(row);
      if (row) {
        const [others, near, rating] = await Promise.all([
          listMarketplaceListings({
            sellerId: row.seller_id,
            viewerId: user?.id,
            status: ["active", "pending"],
            limit: 8,
          }),
          listMarketplaceListings({ viewerId: user?.id, limit: 8 }),
          fetchUserDisplayRating(row.seller_id),
        ]);
        setMore(others.filter((l) => l.id !== row.id));
        setNearby(near.filter((l) => l.id !== row.id && l.seller_id !== row.seller_id).slice(0, 6));
        setOfferAmt(row.price != null ? String(Math.max(0, Math.floor(Number(row.price) * 0.9))) : "");
        setSellerRating(rating);
      } else {
        setSellerRating(null);
      }
    } catch (e: any) {
      toast.error(e?.message || "Listing not found");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = useMemo(() => {
    if (!listing) return [];
    const fromMedia = (listing.media || []).map((m) => m.url).filter(Boolean);
    if (fromMedia.length) return fromMedia;
    return listing.cover_url ? [listing.cover_url] : [];
  }, [listing]);

  const related = useMemo(() => {
    if (!listing) return [];
    const pool = [...more, ...nearby];
    const seen = new Set<string>([listing.id]);
    const sameCat: MarketplaceListing[] = [];
    const other: MarketplaceListing[] = [];
    for (const l of pool) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      if (listing.category && l.category === listing.category) sameCat.push(l);
      else other.push(l);
    }
    return [...sameCat, ...other].slice(0, 8);
  }, [listing, more, nearby]);

  const isOwner = user?.id === listing?.seller_id;
  const { away } = useSellerDistance(listing?.seller_id);
  const cat = getCategory(listing?.category);
  const place = listing
    ? approxLocation(listing.city, listing.state, listing.location_approx)
    : "";

  const goImage = (dir: number) => {
    if (images.length < 2) return;
    setImgIdx((i) => (i + dir + images.length) % images.length);
  };

  const onGalleryTouchStart = (clientX: number) => {
    touchX.current = clientX;
    didSwipe.current = false;
  };

  const onGalleryTouchEnd = (clientX: number) => {
    if (touchX.current === null || images.length < 2) {
      touchX.current = null;
      return;
    }
    const dx = clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 45) {
      didSwipe.current = true;
      goImage(dx < 0 ? 1 : -1);
    }
  };

  const openLightbox = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    if (images.length) setLightbox(true);
  };

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

  const messageSeller = (text?: string) => {
    if (!user || !listing) return toast.error("Sign in to message");
    if (isOwner) return toast.message("This is your listing");
    const intro =
      (text || quickMsg).trim() ||
      `Hi — interested in: ${listing.title} (${formatPrice(listing.price, listing.listing_type)})`;
    void recordListingInquiry(listing.id, user.id, "message");
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
        marketplacePeerRole: "seller",
        introMessage: intro,
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
      });
      toast.success("Offer sent");
      setOfferOpen(false);
      messageSeller(`I'd like to offer ${formatPrice(amount)} for ${listing.title}.`);
    } catch (e: any) {
      toast.error(e?.message || "Could not send offer");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!user || !listing || !isOwner) return;
    try {
      setListing(await updateMarketplaceListing(listing.id, user.id, { status }));
      toast.success(`Marked ${status}`);
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  const confirmBlock = async () => {
    if (!user || !listing) return;
    setBlockBusy(true);
    try {
      await blockUser(user.id, listing.seller_id);
      toast.success(`Blocked ${listing.seller?.display_name || "seller"}`);
      setBlockOpen(false);
      nav("/settings/blocking");
    } catch (e: any) {
      toast.error(e?.message || "Could not block user");
    } finally {
      setBlockBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="aspect-[4/3] animate-pulse bg-muted" />
        <div className="space-y-3 p-4">
          <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
        <p className="font-bold">Listing not found</p>
        <button type="button" onClick={() => nav("/marketplace")} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const desc = sanitizeDescription(listing.description);
  const sellerName = listing.seller?.display_name || "Seller";

  return (
    <MarketplaceLocationGate>
    <div className="min-h-screen bg-background pb-28 text-foreground">
      {/* Photo */}
      <div className="relative">
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow-sm"
            aria-label="Back"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onSave} className="flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow-sm" aria-label="Save">
              <Bookmark className={`h-4 w-4 ${listing.saved ? "fill-foreground" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow-sm"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={openLightbox}
          className="block w-full"
          onTouchStart={(e) => onGalleryTouchStart(e.touches[0].clientX)}
          onTouchEnd={(e) => onGalleryTouchEnd(e.changedTouches[0].clientX)}
        >
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            {images.length ? (
              <div
                className="flex h-full w-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${imgIdx * 100}%)` }}
              >
                {images.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt=""
                    className="h-full w-full shrink-0 object-cover"
                    draggable={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/40">No photo</div>
            )}
          </div>
        </button>
        {images.length > 0 && (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
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
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? "border-foreground" : "border-transparent"}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5 px-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-snug">{listing.title}</h1>
            <p className="mt-1 text-lg font-bold">{formatPrice(listing.price, listing.listing_type)}</p>
            {away && (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Nearby · {away}
              </p>
            )}
          </div>
          {!isOwner && (
            <button
              type="button"
              onClick={() => setMoreOptionsOpen(true)}
              className="shrink-0 pt-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              More options
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => nav(`/marketplace/profile/${listing.seller_id}`)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="h-11 w-11 overflow-hidden rounded-full bg-muted">
            {listing.seller?.avatar_url ? (
              <img src={listing.seller.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {(listing.seller?.display_name || "?")[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{listing.seller?.display_name || "Seller"}</p>
            <UserRatingStars rating={sellerRating} variant="full" className="mt-0.5" />
            <p className="mt-0.5 text-xs text-muted-foreground">
              {place}
              {listing.status === "sold" || listing.status === "pending" ? ` · ${listing.status}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-primary">Profile</span>
        </button>

        <div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{desc || "No description."}</p>
          <p className="mt-2 text-xs text-muted-foreground">{timeAgo(listing.created_at)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[listing.condition, cat?.label].filter(Boolean).join(" · ")}
          </p>
        </div>

        {!isOwner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              messageSeller(quickMsg);
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-4 pr-1"
          >
            <input
              value={quickMsg}
              onChange={(e) => setQuickMsg(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Hi, is this still available?"
            />
            <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}

        {!isOwner && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => messageSeller()} className="h-10 flex-1 rounded-full bg-primary text-sm font-bold text-primary-foreground">
              Message
            </button>
            {listing.open_to_offers && (
              <button type="button" onClick={() => setOfferOpen(true)} className="h-10 flex-1 rounded-full border border-border text-sm font-semibold">
                Make Offer
              </button>
            )}
            <button type="button" onClick={onSave} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Save">
              <Bookmark className={`h-4 w-4 ${listing.saved ? "fill-foreground" : ""}`} />
            </button>
          </div>
        )}

        {!isOwner && <MarketplaceSafetyTips variant="compact" />}

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => nav(`/marketplace/edit/${listing.id}`)} className="rounded-full bg-muted px-3 py-2 text-xs font-semibold">
              Edit
            </button>
            <button type="button" onClick={() => void setStatus("pending")} className="rounded-full bg-muted px-3 py-2 text-xs font-semibold">
              Mark pending
            </button>
            {listing.status !== "sold" ? (
              <button
                type="button"
                onClick={() => setSoldSheetOpen(true)}
                className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                Mark sold
              </button>
            ) : (
              <span className="rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">Sold</span>
            )}
          </div>
        )}

        <section className="border-t border-border pt-4">
          <button type="button" className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5" />
            {place}
          </button>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/50">
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              Approximate area · exact address stays private
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border-2 border-primary/40 bg-primary/15" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Meetup details can be shared privately in chat. Exact home addresses are never shown publicly.
          </p>
        </section>

        {related.length > 0 && (
          <section className="border-t border-border pt-4">
            <h2 className="mb-3 text-base font-bold">Related items</h2>
            <div className="grid grid-cols-2 gap-3">
              {related.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">More listings from {listing.seller?.display_name || "seller"}</h2>
              <button type="button" onClick={() => nav(`/marketplace/profile/${listing.seller_id}`)} className="text-xs font-semibold text-primary">
                See all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {more.slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black" data-no-zoom>
          <div className="flex items-center justify-between px-3 py-3 text-white">
            <span className="text-sm font-semibold">
              {imgIdx + 1} / {images.length}
            </span>
            <button type="button" onClick={() => setLightbox(false)} className="rounded-full bg-white/15 p-2" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center overflow-hidden"
            onTouchStart={(e) => onGalleryTouchStart(e.touches[0].clientX)}
            onTouchEnd={(e) => onGalleryTouchEnd(e.changedTouches[0].clientX)}
          >
            <div
              className="flex h-full w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${imgIdx * 100}%)` }}
            >
              {images.map((url, i) => (
                <div key={url + i} className="flex h-full w-full shrink-0 items-center justify-center p-2">
                  <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goImage(-1)}
                  className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goImage(1)}
                  className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  aria-label={`Photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {offerOpen && listing && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => setOfferOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold">Your offer</h3>
              <button type="button" onClick={() => setOfferOpen(false)} className="rounded-full bg-muted p-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border p-2.5">
              {images[0] ? (
                <img src={images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-muted" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{listing.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(listing.price, listing.listing_type)}
                  {place ? ` · ${place}` : ""}
                </p>
              </div>
            </div>
            {listing.price != null && Number(listing.price) > 0 && (
              <div className="mt-3 space-y-2">
                {[0.9, 1, 1.05].map((mult) => {
                  const amt = Math.round(Number(listing.price) * mult * 100) / 100;
                  const label =
                    mult < 1 ? `${formatPrice(amt)} (10% lower)` : mult > 1 ? formatPrice(amt) : formatPrice(amt);
                  const selected = Number(offerAmt) === amt;
                  return (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setOfferAmt(String(amt))}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${
                        selected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-primary">Or enter a different amount</p>
            <input
              value={offerAmt}
              onChange={(e) => setOfferAmt(e.target.value)}
              type="number"
              className="mt-2 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              placeholder="Your offer ($)"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Your offer is not a payment. Purchase details are arranged later with the seller.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitOffer()}
              className="mt-4 h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              Send offer
            </button>
          </div>
        </div>
      )}

      {user && id && (
        <MarkSoldSheet
          open={soldSheetOpen}
          onClose={() => {
            setSoldSheetOpen(false);
            void load({ silent: true });
          }}
          listingId={listing?.id || id}
          listingTitle={listing?.title || "Listing"}
          sellerId={user.id}
          onSold={(buyerId) => {
            setListing((prev) =>
              prev ? { ...prev, status: "sold", sold_to: buyerId } : prev,
            );
          }}
        />
      )}

      {!isOwner && listing && (
        <>
          <MarketplaceMoreOptionsSheet
            open={moreOptionsOpen}
            onClose={() => setMoreOptionsOpen(false)}
            peerRole="seller"
            peerName={sellerName}
            onViewProfile={() => nav(`/marketplace/profile/${listing.seller_id}`)}
            onReport={() => {
              if (window.confirm("Report this listing? We'll review it.")) {
                toast.message("Report submitted — we'll review this listing");
              }
            }}
            onBlock={() => setBlockOpen(true)}
          />
          <BlockConfirmDialog
            open={blockOpen}
            onClose={() => setBlockOpen(false)}
            onConfirm={() => void confirmBlock()}
            name={sellerName}
            loading={blockBusy}
          />
        </>
      )}
      {shareOpen && listing && (
        <ShareListingSheet listing={listing} storeName={sellerName} onClose={() => setShareOpen(false)} />
      )}
    </div>
    </MarketplaceLocationGate>
  );
}
