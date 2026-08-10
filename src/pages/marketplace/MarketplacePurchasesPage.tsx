import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Receipt, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import {
  CART_STATUS_LABEL,
  completeCart,
  listCartsForUser,
  type MarketplaceCart,
} from "@/lib/marketplace-cart";
import { listReceipts, sendReceipt } from "@/lib/marketplace-receipts";
import { listMyReviewedCartIds } from "@/lib/store-reviews";
import RateStoreSellerSheet from "@/components/marketplace/RateStoreSellerSheet";


/** Everything the buyer has bought — marketplace and $1–$5 store orders. */
export default function MarketplacePurchasesPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "pending" | "completed">("all");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState<MarketplaceCart | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listCartsForUser(user.id, "buyer");
      setOrders(rows.filter((o) => o.status !== "open"));
      setReviewed(await listMyReviewedCartIds(user.id).catch(() => new Set<string>()));
    } catch (e: any) {
      toast.error(e?.message || "Could not load your purchases");
    } finally {
      setLoading(false);
    }
  }, [user]);

  /** Buyer confirms they received the order. */
  const confirm = async (order: MarketplaceCart) => {
    setBusy(order.id);
    try {
      await completeCart(order.id);
      toast.success("Thanks — order confirmed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not confirm this order");
    } finally {
      setBusy(null);
    }
  };


  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (tab === "pending") return orders.filter((o) => ["submitted", "approved", "ready"].includes(o.status));
    if (tab === "completed") return orders.filter((o) => o.status === "completed");
    return orders;
  }, [orders, tab]);

  const send = async (order: MarketplaceCart) => {
    if (!user) return;
    setBusy(order.id);
    try {
      const receipts = await listReceipts(user.id, "buyer");
      const r = receipts.find((x) => x.id === order.id);
      if (!r) throw new Error("Receipt is not ready yet — the seller has to approve the order first");
      await sendReceipt(r, user.id, order.seller?.display_name || null);
      toast.success("Receipt sent in Messages");
    } catch (e: any) {
      toast.error(e?.message || "Could not send the receipt");
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="font-black">Sign in to see your purchases</p>
        <button
          type="button"
          onClick={() => nav("/auth")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/marketplace/account")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">My purchases</h1>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        {(["all", "pending", "completed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
              tab === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-semibold">Nothing here yet.</p>
          <button
            type="button"
            onClick={() => nav("/marketplace/five-under")}
            className="mt-3 text-sm font-bold text-primary"
          >
            Shop the $1–$5 Store
          </button>
        </div>
      ) : (
        <div className="space-y-3 px-3">
          {shown.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
                  {CART_STATUS_LABEL[o.status] || o.status}
                </span>
              </div>

              <button
                type="button"
                onClick={() => nav(`/marketplace/store/${o.seller_id}`)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-black"
              >
                <Store className="h-3.5 w-3.5 text-primary" />
                {o.seller?.display_name || "Seller"}
              </button>

              <div className="mt-2 space-y-2">
                {o.items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => nav(`/marketplace/product/${i.listing_id}`)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    {i.cover_url ? (
                      <img src={i.cover_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{i.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {i.qty} × {formatPrice(i.unit_price)}
                      </span>
                    </span>
                    <span className="text-sm font-black">{formatPrice(i.qty * i.unit_price)}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2 border-t border-border pt-2 text-[12px]">
                <p className="flex justify-between text-muted-foreground">
                  <span>{o.fulfillment === "delivery" ? "Delivery" : "Pickup"}</span>
                  <span>{o.fulfillment === "delivery" ? formatPrice(o.delivery_fee) : "Free"}</span>
                </p>
                <p className="mt-0.5 flex justify-between font-black">
                  <span>Total</span>
                  <span>{formatPrice(o.total)}</span>
                </p>
              </div>

              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={busy === o.id}
                  onClick={() => void send(o)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  {busy === o.id ? "Sending…" : "Send receipt"}
                </button>
                <button
                  type="button"
                  onClick={() => nav("/marketplace/messages")}
                  className="rounded-full bg-muted px-3 py-1.5 text-[12px] font-bold"
                >
                  Message seller
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
