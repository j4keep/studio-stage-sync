import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import { listReceipts, sendReceipt, type MarketplaceReceipt } from "@/lib/marketplace-receipts";

/** Saved receipts for confirmed orders — sellers and buyers can re-send them any time. */
export default function MarketplaceReceiptsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = params.get("role") === "buyer" ? "buyer" : "seller";
  const [rows, setRows] = useState<MarketplaceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setRows(await listReceipts(user.id, role));
    } catch (e: any) {
      toast.error(e?.message || "Could not load your receipts");
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (r: MarketplaceReceipt) => {
    if (!user) return;
    setBusy(r.id);
    try {
      await sendReceipt(r, user.id, r.seller?.display_name);
      toast.success(role === "seller" ? "Receipt sent to the buyer" : "Receipt sent to the seller");
    } catch (e: any) {
      toast.error(e?.message || "Could not send the receipt");
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="font-black">Sign in to see your receipts</p>
        <button type="button" onClick={() => nav("/auth")} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 space-y-2.5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-black leading-tight">Receipts</h1>
            <p className="text-[11px] text-muted-foreground">Saved automatically when an order is confirmed</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["seller", "buyer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setParams({ role: r })}
              className={`flex-1 rounded-full px-3 py-2 text-[12px] font-black ${
                role === r ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {r === "seller" ? "Sold" : "Bought"}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <Receipt className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="font-bold">No receipts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A receipt is filed here as soon as an order is approved.
            </p>
          </div>
        ) : (
          rows.map((r) => (
            <section key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black">{r.receipt_no}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()} ·{" "}
                    {role === "seller"
                      ? r.buyer?.display_name || "Buyer"
                      : r.store_name || r.seller?.display_name || "Seller"}
                  </p>

                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold capitalize">
                  {r.fulfillment}
                </span>
              </div>
              <div className="space-y-1 px-4 py-3 text-[13px]">
                {r.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {i.qty} × {i.title}
                    </span>
                    <span className="font-semibold">{formatPrice(i.qty * i.unit_price)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{formatPrice(r.subtotal)}</span>
                </div>
                {r.fulfillment === "delivery" && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span className="font-semibold text-foreground">{formatPrice(r.delivery_fee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-black">
                  <span>Total</span>
                  <span>{formatPrice(r.total)}</span>
                </div>
              </div>
              <div className="px-4 pb-3">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void send(r)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-black text-primary-foreground disabled:opacity-60"
                >
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send receipt
                </button>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
