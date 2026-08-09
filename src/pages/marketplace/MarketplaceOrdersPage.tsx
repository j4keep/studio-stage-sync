import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import { CART_STATUS_LABEL, listCartsForUser, setCartStatus, type MarketplaceCart } from "@/lib/marketplace-cart";

export default function MarketplaceOrdersPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [fee, setFee] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setOrders(await listCartsForUser(user.id, "seller"));
    } catch (e: any) {
      toast.error(e?.message || "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (cart: MarketplaceCart, status: "ready" | "completed" | "cancelled") => {
    setBusy(cart.id);
    try {
      const parsed = Number(fee[cart.id]);
      await setCartStatus(cart.id, status, Number.isFinite(parsed) && fee[cart.id] ? parsed : undefined);
      toast.success(status === "cancelled" ? "Order cancelled" : "Order updated");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update order");
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="font-black">Sign in to see your orders</p>
        <button type="button" onClick={() => nav("/auth")} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
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
          onClick={() => nav("/marketplace")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-black leading-tight">Cart orders</h1>
          <p className="text-[11px] text-muted-foreground">Live carts and submitted orders from buyers</p>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {loading ? (
          <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <p className="font-bold">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Items appear here when a buyer adds them to a cart.</p>
          </div>
        ) : (
          orders.map((cart) => (
            <section key={cart.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{cart.buyer?.display_name || "Buyer"}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    {cart.fulfillment}
                    {cart.delivery_address ? ` · ${cart.delivery_address}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
                  {CART_STATUS_LABEL[cart.status]}
                </span>
              </div>

              <div className="divide-y divide-border">
                {cart.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {i.cover_url && <img src={i.cover_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <p className="min-w-0 flex-1 line-clamp-1 text-sm font-semibold">{i.title}</p>
                    <p className="text-sm font-black">
                      {i.qty} × {formatPrice(i.unit_price)}
                    </p>
                  </div>
                ))}
              </div>

              {cart.note && <p className="px-4 pt-2 text-xs text-muted-foreground">“{cart.note}”</p>}

              <div className="space-y-2.5 px-4 py-3">
                {cart.fulfillment === "delivery" && cart.status === "submitted" && (
                  <input
                    value={fee[cart.id] ?? (cart.delivery_fee ? String(cart.delivery_fee) : "")}
                    onChange={(e) => setFee((f) => ({ ...f, [cart.id]: e.target.value }))}
                    placeholder="Delivery fee ($)"
                    type="number"
                    className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  />
                )}
                <div className="flex items-center justify-between text-sm font-black">
                  <span>Total</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>
                {cart.status !== "completed" && cart.status !== "cancelled" && (
                  <div className="flex gap-2">
                    {cart.status === "submitted" && (
                      <button
                        type="button"
                        disabled={busy === cart.id}
                        onClick={() => void act(cart, "ready")}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-xs font-black text-primary-foreground disabled:opacity-60"
                      >
                        {busy === cart.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Mark ready
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === cart.id}
                      onClick={() => void act(cart, "completed")}
                      className="h-11 flex-1 rounded-full bg-muted text-xs font-black disabled:opacity-60"
                    >
                      Completed
                    </button>
                    <button
                      type="button"
                      disabled={busy === cart.id}
                      onClick={() => void act(cart, "cancelled")}
                      className="h-11 rounded-full bg-muted px-4 text-xs font-black text-red-500 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => nav(`/messages?user=${cart.buyer_id}`)}
                  className="h-10 w-full rounded-full border border-border text-xs font-bold"
                >
                  Message buyer
                </button>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
