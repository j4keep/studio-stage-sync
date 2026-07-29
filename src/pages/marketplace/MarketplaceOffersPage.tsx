import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, timeAgo } from "@/lib/marketplace";
import { listOffersForUser, updateOfferStatus } from "@/lib/marketplace-api";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import UserRatingStars from "@/components/UserRatingStars";
import RateMarketplaceSheet from "@/components/marketplace/RateMarketplaceSheet";

function statusStyle(status: string) {
  switch (status) {
    case "accepted":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "declined":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    case "countered":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    default:
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
  }
}

export default function MarketplaceOffersPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [offers, setOffers] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<string, DisplayRating>>({});
  const [loading, setLoading] = useState(true);
  const [rateTarget, setRateTarget] = useState<{
    offerId: string;
    listingId: string;
    rateeId: string;
    rateeName: string;
    rateeRole: "seller" | "buyer";
  } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listOffersForUser(user.id, tab === "received" ? "seller" : "buyer");
      setOffers(rows);
      const ids = rows.flatMap((o: any) => [o.buyer_id, o.seller_id]).filter(Boolean);
      setRatings(await fetchRatingsByUserIds(ids));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, status: "accepted" | "declined" | "cancelled") => {
    if (!user) return;
    try {
      await updateOfferStatus(id, user.id, status);
      toast.success(
        status === "accepted"
          ? "Offer accepted — buyer was notified in chat"
          : status === "declined"
            ? "Offer declined — buyer was notified in chat"
            : "Offer cancelled",
      );
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/marketplace/account")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Offers</h1>
      </header>

      <div className="flex border-b border-border px-4">
        {(
          [
            ["received", "Received"],
            ["sent", "Sent"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 border-b-2 py-2.5 text-sm font-bold ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-3">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : offers.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {tab === "received" ? "No offers on your listings yet." : "You haven’t sent any offers yet."}
          </p>
        ) : (
          offers.map((o) => {
            const counterparty = tab === "received" ? o.buyer : o.seller;
            const counterpartyId = tab === "received" ? o.buyer_id : o.seller_id;
            const title = o.listing?.title || "Listing";
            const cover = o.listing?.cover_url;
            return (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => nav(`/marketplace/listing/${o.listing_id}`)}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted"
                  >
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">·</div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{title}</p>
                        <p className="mt-0.5 text-base font-black">{formatPrice(Number(o.amount))}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusStyle(o.status)}`}>
                        {o.status}
                      </span>
                    </div>
                    {o.message && <p className="mt-1 text-xs text-muted-foreground">{o.message}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(o.created_at)}</p>
                  </div>
                </div>

                {counterpartyId && (
                  <button
                    type="button"
                    onClick={() => nav(`/marketplace/profile/${counterpartyId}`)}
                    className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-left"
                  >
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                      {counterparty?.avatar_url ? (
                        <img src={counterparty.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                          {(counterparty?.display_name || "?")[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {counterparty?.display_name || (tab === "received" ? "Buyer" : "Seller")}
                      </p>
                      <UserRatingStars rating={ratings[counterpartyId]} variant="compact" className="mt-0.5" />
                    </div>
                    <span className="text-[11px] font-semibold text-primary">
                      {tab === "received" ? "Buyer profile" : "Seller profile"}
                    </span>
                  </button>
                )}

                {tab === "received" && o.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void act(o.id, "declined")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-muted text-xs font-bold"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(o.id, "accepted")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-bold text-primary-foreground"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </button>
                  </div>
                )}

                {tab === "sent" && o.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void act(o.id, "cancelled")}
                    className="mt-3 h-10 w-full rounded-full bg-muted text-xs font-bold"
                  >
                    Cancel offer
                  </button>
                )}

                {tab === "sent" && (o.status === "accepted" || o.status === "declined") && (
                  <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {o.status === "accepted"
                      ? "Seller accepted your offer. Arrange pickup details in chat."
                      : "Seller declined this offer. You can message them or browse similar listings."}
                  </p>
                )}

                {o.status === "accepted" && user && counterpartyId && (
                  <button
                    type="button"
                    onClick={() =>
                      setRateTarget({
                        offerId: o.id,
                        listingId: o.listing_id,
                        rateeId: counterpartyId,
                        rateeName: counterparty?.display_name || (tab === "received" ? "Buyer" : "Seller"),
                        rateeRole: tab === "received" ? "buyer" : "seller",
                      })
                    }
                    className="mt-2 h-9 w-full rounded-full border border-border text-xs font-bold"
                  >
                    Rate {tab === "received" ? "buyer" : "seller"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {user && rateTarget && (
        <RateMarketplaceSheet
          open={!!rateTarget}
          onClose={() => setRateTarget(null)}
          offerId={rateTarget.offerId}
          listingId={rateTarget.listingId}
          raterId={user.id}
          rateeId={rateTarget.rateeId}
          rateeName={rateTarget.rateeName}
          rateeRole={rateTarget.rateeRole}
          onRated={() => void load()}
        />
      )}
    </div>
  );
}
