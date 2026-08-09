import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Minus, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import {
  CART_STATUS_LABEL,
  listCartsForUser,
  listMyOpenCarts,
  setCartItem,
  submitCart,
  type MarketplaceCart,
} from "@/lib/marketplace-cart";

export default function MarketplaceCartPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState<MarketplaceCart[]>([]);
  const [past, setPast] = useState<MarketplaceCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<Record<string, "pickup" | "delivery">>({});
  const [address, setAddress] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [o, p] = await Promise.all([listMyOpenCarts(user.id), listCartsForUser(user.id, "buyer")]);
      setOpen(o);
      setPast(p);
    } catch (e: any) {
      toast.error(e?.message || "Could not load your cart");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (cartId: string, listingId: string, qty: number, stock: number) => {
    if (qty > stock) return toast.error(`Only ${stock} in stock`);
    setBusy(cartId);
    try {
      await setCartItem(listingId, Math.max(0, qty));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update cart");
    } finally {
      setBusy(null);
    }
  };

  const send = async (cart: MarketplaceCart) => {
    const mode = fulfillment[cart.id] || "pickup";
    if (mode === "delivery" && !(address[cart.id] || "").trim()) {
      return toast.error("Add a delivery address");
    }
    setBusy(cart.id);
    try {
      await submitCart(cart.id, mode, address[cart.id], note[cart.id]);
      toast.success("Sent to the seller — they'll confirm and set any delivery fee");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not send order");
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="font-black">Sign in to use your cart</p>
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
          onClick={() => nav("/marketplace/five-under")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-black leading-tight">Your cart</h1>
          <p className="text-[11px] text-muted-foreground">One cart per seller</p>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-4">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
            <p className="font-bold">Your cart is empty</p>
            <button
              type="button"
              onClick={() => nav("/marketplace/five-under")}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Browse $1–$5 Finds
            </button>
          </div>
        ) : (
          open.map((cart) => {
            const mode = fulfillment[cart.id] || "pickup";
            return (
              <section key={cart.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seller</p>
                  <p className="text-sm font-bold">{cart.seller?.display_name || "Seller"}</p>
                </div>
                <div className="divide-y divide-border">
                  {cart.items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {i.cover_url && <img src={i.cover_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold">{i.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(i.unit_price)} · {i.stock} in stock
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy === cart.id}
                          onClick={() => void change(cart.id, i.listing_id, i.qty - 1, i.stock)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                          aria-label="Remove one"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-black">{i.qty}</span>
                        <button
                          type="button"
                          disabled={busy === cart.id || i.qty >= i.stock}
                          onClick={() => void change(cart.id, i.listing_id, i.qty + 1, i.stock)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted disabled:opacity-40"
                          aria-label="Add one"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 px-4 py-3">
                  <div className="flex gap-2">
                    {(["pickup", "delivery"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFulfillment((f) => ({ ...f, [cart.id]: m }))}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold capitalize ${
                          mode === m ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {mode === "delivery" && (
                    <>
                      <input
                        value={address[cart.id] || ""}
                        onChange={(e) => setAddress((a) => ({ ...a, [cart.id]: e.target.value }))}
                        placeholder="Delivery address"
                        className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                      />
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Truck className="h-3.5 w-3.5" /> The seller sets the delivery fee when they confirm.
                      </p>
                    </>
                  )}
                  <input
                    value={note[cart.id] || ""}
                    onChange={(e) => setNote((n) => ({ ...n, [cart.id]: e.target.value }))}
                    placeholder="Note for the seller (optional)"
                    className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  />
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>Subtotal</span>
                    <span>{formatPrice(cart.subtotal)}</span>
                  </div>
                  <button
                    type="button"
                    disabled={busy === cart.id || cart.items.length === 0}
                    onClick={() => void send(cart)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-black text-primary-foreground disabled:opacity-60"
                  >
                    {busy === cart.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send order to seller
                  </button>
                </div>
              </section>
            );
          })
        )}

        {past.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-muted-foreground">Your orders</h2>
            <div className="space-y-2">
              {past.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{c.seller?.display_name || "Seller"}</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
                      {CART_STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.items.length} item{c.items.length === 1 ? "" : "s"} · {c.fulfillment} · {formatPrice(c.total)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
