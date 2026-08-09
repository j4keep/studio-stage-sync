import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FIVE_UNDER_MAX, FIVE_UNDER_MIN, formatPrice } from "@/lib/marketplace";
import {
  compressImage,
  getMarketplaceProfile,
  listMarketplaceListings,
  listingCoverUrl,
  softDeleteListing,
  updateMarketplaceListing,
  updateMarketplaceProfile,
  uploadListingImage,
  type MarketplaceListing,
  type MarketplaceProfile,
} from "@/lib/marketplace-api";
import { CART_STATUS_LABEL, listCartsForUser, setCartStatus, type MarketplaceCart } from "@/lib/marketplace-cart";

type Tab = "orders" | "products" | "storefront";

/** Seller dashboard for the $1–$5 store: approve orders, manage products, brand the store. */
export default function StoreDashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<MarketplaceCart[]>([]);
  const [products, setProducts] = useState<MarketplaceListing[]>([]);
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fee, setFee] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, { price: string; quantity: string }>>({});
  const [storeName, setStoreName] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cartRows, listingRows, prof] = await Promise.all([
        listCartsForUser(user.id, "seller"),
        listMarketplaceListings({
          sellerId: user.id,
          viewerId: user.id,
          listingType: "five_under",
          status: ["active", "draft", "pending", "sold"],
          limit: 100,
        }),
        getMarketplaceProfile(user.id),
      ]);
      setOrders(cartRows.filter((c) => c.status !== "open"));
      setProducts(listingRows);
      setProfile(prof);
      setStoreName(prof?.store_name || "");
      setStoreTagline(prof?.store_tagline || "");
      setBanner(prof?.store_banner_url || null);
      setDraft(
        Object.fromEntries(
          listingRows.map((l) => [l.id, { price: String(l.price ?? ""), quantity: String(l.quantity ?? 0) }]),
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not load your store");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "submitted").length, [orders]);

  const act = async (cart: MarketplaceCart, status: "approved" | "ready" | "completed" | "cancelled") => {
    setBusy(cart.id);
    try {
      const parsed = Number(fee[cart.id]);
      await setCartStatus(cart.id, status, Number.isFinite(parsed) && fee[cart.id] ? parsed : undefined);
      toast.success(
        status === "approved"
          ? "Order approved — the buyer was notified"
          : status === "cancelled"
            ? "Order cancelled"
            : "Order updated",
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update order");
    } finally {
      setBusy(null);
    }
  };

  const saveProduct = async (listing: MarketplaceListing) => {
    if (!user) return;
    const d = draft[listing.id];
    const price = Number(d?.price);
    const quantity = Number(d?.quantity);
    if (!Number.isFinite(price) || price < FIVE_UNDER_MIN || price > FIVE_UNDER_MAX) {
      return toast.error(`Price must be between $${FIVE_UNDER_MIN} and $${FIVE_UNDER_MAX}`);
    }
    if (!Number.isInteger(quantity) || quantity < 0) return toast.error("Quantity must be a whole number");
    setBusy(listing.id);
    try {
      await updateMarketplaceListing(listing.id, user.id, {
        listing_type: "five_under",
        price,
        quantity: Math.max(quantity, 1),
        status: quantity === 0 ? "sold" : "active",
      });
      toast.success("Product updated");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update product");
    } finally {
      setBusy(null);
    }
  };

  const removeProduct = async (listing: MarketplaceListing) => {
    if (!user) return;
    if (!window.confirm(`Delete "${listing.title}" from your store?`)) return;
    setBusy(listing.id);
    try {
      await softDeleteListing(listing.id, user.id);
      toast.success("Product deleted");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete product");
    } finally {
      setBusy(null);
    }
  };

  const pickBanner = async (file: File | null) => {
    if (!file || !user) return;
    setSavingStore(true);
    try {
      const small = await compressImage(file, 1600, 0.85);
      const url = await uploadListingImage(user.id, small);
      setBanner(url);
      await updateMarketplaceProfile(user.id, { store_banner_url: url });
      toast.success("Store header updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not upload the header image");
    } finally {
      setSavingStore(false);
    }
  };

  const saveStore = async () => {
    if (!user) return;
    setSavingStore(true);
    try {
      await updateMarketplaceProfile(user.id, {
        store_name: storeName.trim() || null,
        store_tagline: storeTagline.trim() || null,
      });
      toast.success("Storefront saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save your storefront");
    } finally {
      setSavingStore(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
        <p className="font-black">Sign in to manage your store</p>
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
      <header className="sticky top-0 z-20 space-y-2.5 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/pro")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black leading-tight">$1–$5 Store Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">Orders, products & your storefront</p>
          </div>
          <button
            type="button"
            onClick={() => nav("/marketplace/create?type=five_under")}
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-[12px] font-black text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Product
          </button>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              { id: "orders" as Tab, label: pendingCount > 0 ? `Orders · ${pendingCount}` : "Orders" },
              { id: "products" as Tab, label: `Products · ${products.length}` },
              { id: "storefront" as Tab, label: "Storefront" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-bold ${
                tab === t.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3 px-3 pt-4">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : tab === "orders" ? (
        <div className="space-y-3 px-3 pt-3">
          {orders.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No orders yet. Buyers' orders land here for approval.
            </p>
          ) : (
            orders.map((cart) => (
              <section key={cart.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{cart.buyer?.display_name || "Buyer"}</p>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">
                      {cart.fulfillment}
                      {cart.delivery_address ? ` · ${cart.delivery_address}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
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
                    <div className="flex flex-wrap gap-2">
                      {cart.status === "submitted" && (
                        <button
                          type="button"
                          disabled={busy === cart.id}
                          onClick={() => void act(cart, "approved")}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-xs font-black text-primary-foreground disabled:opacity-60"
                        >
                          {busy === cart.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Approve order
                        </button>
                      )}
                      {cart.status === "approved" && (
                        <button
                          type="button"
                          disabled={busy === cart.id}
                          onClick={() => void act(cart, "ready")}
                          className="h-11 flex-1 rounded-full bg-primary text-xs font-black text-primary-foreground disabled:opacity-60"
                        >
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
                    onClick={() =>
                      nav("/messages", {
                        state: {
                          startWithUserId: cart.buyer_id,
                          startWithProfile: {
                            user_id: cart.buyer_id,
                            display_name: cart.buyer?.display_name ?? null,
                            avatar_url: cart.buyer?.avatar_url ?? null,
                          },
                        },
                      })
                    }
                    className="h-10 w-full rounded-full border border-border text-xs font-bold"
                  >
                    Message buyer
                  </button>
                </div>
              </section>
            ))
          )}
        </div>
      ) : tab === "products" ? (
        <div className="space-y-2.5 px-3 pt-3">
          {products.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No dollar-store products yet. Tap “Product” to add one.
            </p>
          ) : (
            products.map((l) => {
              const d = draft[l.id] || { price: "", quantity: "" };
              const cover = listingCoverUrl(l);
              return (
                <section key={l.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold leading-snug">{l.title}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{l.status}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => nav(`/marketplace/edit/${l.id}`)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                      aria-label="Edit product"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeProduct(l)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-red-500"
                      aria-label="Delete product"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <label className="flex-1 text-[11px] font-bold text-muted-foreground">
                      Price ($1–$5)
                      <input
                        value={d.price}
                        onChange={(e) => setDraft((s) => ({ ...s, [l.id]: { ...d, price: e.target.value } }))}
                        type="number"
                        step="0.01"
                        className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground"
                      />
                    </label>
                    <label className="flex-1 text-[11px] font-bold text-muted-foreground">
                      Quantity
                      <input
                        value={d.quantity}
                        onChange={(e) => setDraft((s) => ({ ...s, [l.id]: { ...d, quantity: e.target.value } }))}
                        type="number"
                        className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => void saveProduct(l)}
                      className="h-11 rounded-full bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-60"
                    >
                      Save
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3 px-3 pt-3">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative h-36 w-full bg-muted">
              {banner ? (
                <img src={banner} alt="Store header" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No store header yet
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1.5 text-[11px] font-black text-background"
              >
                {savingStore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {banner ? "Change header" : "Add header"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickBanner(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2.5 p-3">
              <label className="block text-[11px] font-bold text-muted-foreground">
                Store name
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={profile?.display_name || "My store"}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground"
                />
              </label>
              <label className="block text-[11px] font-bold text-muted-foreground">
                Tagline
                <input
                  value={storeTagline}
                  onChange={(e) => setStoreTagline(e.target.value)}
                  placeholder="Everyday essentials for $1–$5"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground"
                />
              </label>
              <button
                type="button"
                disabled={savingStore}
                onClick={() => void saveStore()}
                className="h-11 w-full rounded-full bg-primary text-xs font-black text-primary-foreground disabled:opacity-60"
              >
                Save storefront
              </button>
              <button
                type="button"
                onClick={() => nav("/marketplace/five-under")}
                className="h-10 w-full rounded-full border border-border text-xs font-bold"
              >
                View my store in the $1–$5 section
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
