import { supabase } from "@/integrations/supabase/client";
import { resolveMarketplaceMediaUrl } from "@/lib/marketplace-api";

export type CartStatus = "open" | "submitted" | "ready" | "completed" | "cancelled";

export type CartLine = {
  id: string;
  listing_id: string;
  qty: number;
  unit_price: number;
  title: string;
  cover_url: string | null;
  /** Seller's current inventory for this listing */
  stock: number;
};

export type MarketplaceCart = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: CartStatus;
  fulfillment: "pickup" | "delivery";
  delivery_fee: number;
  delivery_address: string | null;
  note: string | null
  created_at: string;
  updated_at: string;
  items: CartLine[];
  subtotal: number;
  total: number;
  buyer?: { user_id: string; display_name: string | null; avatar_url: string | null } | null;
  seller?: { user_id: string; display_name: string | null; avatar_url: string | null } | null;
};

async function hydrate(rows: any[]): Promise<MarketplaceCart[]> {
  if (!rows.length) return [];
  const cartIds = rows.map((r) => r.id);
  const { data: itemRows, error } = await (supabase as any)
    .from("marketplace_cart_items")
    .select("*")
    .in("cart_id", cartIds);
  if (error) throw error;

  const listingIds = [...new Set((itemRows || []).map((i: any) => i.listing_id))] as string[];
  const peopleIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))] as string[];

  const [{ data: listings }, { data: profiles }] = await Promise.all([
    listingIds.length
      ? (supabase as any)
          .from("marketplace_listings")
          .select("id, title, price, cover_url, quantity, status")
          .in("id", listingIds)
      : Promise.resolve({ data: [] }),
    peopleIds.length
      ? supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", peopleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const listingMap = new Map((listings || []).map((l: any) => [l.id, l]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  return rows.map((r) => {
    const items: CartLine[] = (itemRows || [])
      .filter((i: any) => i.cart_id === r.id)
      .map((i: any) => {
        const l: any = listingMap.get(i.listing_id) || {};
        return {
          id: i.id,
          listing_id: i.listing_id,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
          title: l.title || "Item",
          cover_url: resolveMarketplaceMediaUrl(l.cover_url),
          stock: Number(l.quantity ?? 0),
        };
      });
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
    const fee = Number(r.delivery_fee || 0);
    return {
      ...r,
      delivery_fee: fee,
      items,
      subtotal,
      total: subtotal + (r.fulfillment === "delivery" ? fee : 0),
      buyer: profileMap.get(r.buyer_id) || null,
      seller: profileMap.get(r.seller_id) || null,
    } as MarketplaceCart;
  });
}

/** Buyer's open carts (one per seller). */
export async function listMyOpenCarts(buyerId: string): Promise<MarketplaceCart[]> {
  const { data, error } = await (supabase as any)
    .from("marketplace_carts")
    .select("*")
    .eq("buyer_id", buyerId)
    .eq("status", "open")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return hydrate(data || []);
}

export async function listCartsForUser(userId: string, role: "buyer" | "seller"): Promise<MarketplaceCart[]> {
  let query = (supabase as any)
    .from("marketplace_carts")
    .select("*")
    .eq(role === "buyer" ? "buyer_id" : "seller_id", userId)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (role === "buyer") query = query.neq("status", "open");
  const { data, error } = await query;
  if (error) throw error;
  return hydrate(data || []);
}

/** Set (or remove, with qty 0) a line. Inventory + $5 cap enforced server-side. */
export async function setCartItem(listingId: string, qty: number) {
  const { data, error } = await (supabase as any).rpc("mp_set_cart_item", {
    p_listing_id: listingId,
    p_qty: qty,
  });
  if (error) throw new Error(cleanError(error.message));
  return data as string;
}

export async function submitCart(
  cartId: string,
  fulfillment: "pickup" | "delivery",
  address?: string | null,
  note?: string | null,
) {
  const { error } = await (supabase as any).rpc("mp_submit_cart", {
    p_cart_id: cartId,
    p_fulfillment: fulfillment,
    p_address: address || null,
    p_note: note || null,
  });
  if (error) throw new Error(cleanError(error.message));
}

export async function setCartStatus(cartId: string, status: "ready" | "completed" | "cancelled", deliveryFee?: number) {
  const { error } = await (supabase as any).rpc("mp_set_cart_status", {
    p_cart_id: cartId,
    p_status: status,
    p_delivery_fee: deliveryFee ?? null,
  });
  if (error) throw new Error(cleanError(error.message));
}

function cleanError(msg?: string) {
  const m = (msg || "Something went wrong").replace(/^.*?:\s*/, "");
  return m || "Something went wrong";
}

export const CART_STATUS_LABEL: Record<CartStatus, string> = {
  open: "In cart",
  submitted: "Sent to seller",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
