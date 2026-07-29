import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listListingInquirers,
  markListingSold,
  type ListingInquirer,
} from "@/lib/marketplace-api";
import { formatPrice } from "@/lib/marketplace";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import UserRatingStars from "@/components/UserRatingStars";
import RateMarketplaceSheet from "@/components/marketplace/RateMarketplaceSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  /** Called after listing is marked sold — do NOT full-page reload here or the rate sheet unmounts */
  onSold: (buyerId: string | null) => void;
};

/** Mark listing sold → pick buyer from people who inquired → rate them right away. */
export default function MarkSoldSheet({
  open,
  onClose,
  listingId,
  listingTitle,
  sellerId,
  onSold,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inquirers, setInquirers] = useState<ListingInquirer[]>([]);
  const [ratings, setRatings] = useState<Record<string, DisplayRating>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [rateBuyer, setRateBuyer] = useState<ListingInquirer | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setSelected(null);
    setRateBuyer(null);
    void (async () => {
      try {
        const rows = await listListingInquirers(listingId, sellerId);
        if (!alive) return;
        setInquirers(rows);
        const accepted = rows.find((r) => r.offer_status === "accepted");
        if (accepted) setSelected(accepted.user_id);
        else if (rows.length === 1) setSelected(rows[0].user_id);
        setRatings(await fetchRatingsByUserIds(rows.map((r) => r.user_id)));
      } catch (e: any) {
        toast.error(e?.message || "Could not load people who inquired");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, listingId, sellerId]);

  // Keep mounted while rating so the rate sheet isn't unmounted when picker closes
  if (!open && !rateBuyer) return null;

  const finishAll = () => {
    setRateBuyer(null);
    onClose();
  };

  const confirmSold = async (buyerId: string | null) => {
    setSaving(true);
    try {
      const buyerRow = buyerId
        ? inquirers.find((i) => i.user_id === buyerId) || {
            user_id: buyerId,
            display_name: "Buyer",
            avatar_url: null,
            sources: [] as string[],
            last_at: new Date().toISOString(),
            offer_id: null,
          }
        : null;

      await markListingSold(listingId, sellerId, buyerId);

      if (buyerRow) {
        // Set rating target first so the sheet opens before parent soft-updates
        setRateBuyer(buyerRow);
        onSold(buyerId);
        toast.success("Marked sold — rate your buyer");
      } else {
        onSold(buyerId);
        toast.success("Marked sold");
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not mark sold");
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = (sources: string[]) => {
    const parts: string[] = [];
    if (sources.includes("offer")) parts.push("Offered");
    if (sources.includes("message")) parts.push("Messaged");
    if (sources.includes("comment")) parts.push("Commented");
    return parts.join(" · ") || "Inquired";
  };

  const showPicker = open && !rateBuyer;

  return (
    <>
      {showPicker && (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={onClose}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-background shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold">Who did you sell to?</h2>
                <p className="truncate text-xs text-muted-foreground">{listingTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-3 text-xs text-muted-foreground">
                Pick someone who messaged, offered, or asked about this listing — then rate them.
              </p>

              {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
              ) : inquirers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-semibold">No inquiries yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When someone messages or offers on this listing, they’ll show up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inquirers.map((person) => {
                    const isSelected = selected === person.user_id;
                    return (
                      <button
                        key={person.user_id}
                        type="button"
                        onClick={() => setSelected(person.user_id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                          isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <div className="h-11 w-11 overflow-hidden rounded-full bg-muted">
                          {person.avatar_url ? (
                            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                              {(person.display_name || "?")[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{person.display_name || "Member"}</p>
                          <UserRatingStars rating={ratings[person.user_id]} variant="compact" className="mt-0.5" />
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {sourceLabel(person.sources)}
                            {person.offer_amount != null ? ` · ${formatPrice(person.offer_amount)}` : ""}
                            {person.offer_status === "accepted" ? " · Accepted offer" : ""}
                          </p>
                        </div>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/35"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={saving || !selected}
                onClick={() => void confirmSold(selected)}
                className="h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Mark sold & rate buyer"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSold(null)}
                className="h-10 w-full rounded-full bg-muted text-xs font-semibold disabled:opacity-50"
              >
                Mark sold without selecting a buyer
              </button>
            </div>
          </div>
        </div>
      )}

      <RateMarketplaceSheet
        open={!!rateBuyer}
        onClose={finishAll}
        offerId={rateBuyer?.offer_id || listingId}
        listingId={listingId}
        raterId={sellerId}
        rateeId={rateBuyer?.user_id || ""}
        rateeName={rateBuyer?.display_name || "Buyer"}
        rateeRole="buyer"
        onRated={finishAll}
      />
    </>
  );
}
