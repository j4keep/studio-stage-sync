import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/marketplace";
import { getOrCreateConversation } from "@/lib/messaging";
import { listCartsForUser, type MarketplaceCart } from "@/lib/marketplace-cart";

/** A receipt is a confirmed order — kept on file so either side can re-send it later. */
export type MarketplaceReceipt = MarketplaceCart & {
  receipt_no: string;
  /** Seller's store name (preferred on the receipt over their profile name). */
  store_name?: string | null;
};

const RECEIPT_STATUSES = new Set(["approved", "ready", "completed"]);

const receiptNo = (cart: MarketplaceCart) =>
  `YAJ-${new Date(cart.created_at).toISOString().slice(0, 10).replace(/-/g, "")}-${cart.id.slice(0, 6).toUpperCase()}`;

/** Store names for the sellers behind these orders. */
async function sellerStoreNames(sellerIds: string[]) {
  const map = new Map<string, string | null>();
  if (!sellerIds.length) return map;
  const { data } = await (supabase as any)
    .from("marketplace_profiles")
    .select("user_id, store_name")
    .in("user_id", sellerIds);
  for (const row of data || []) map.set(row.user_id, row.store_name ?? null);
  return map;
}

/** Every confirmed order for this person, newest first, as receipts. */
export async function listReceipts(userId: string, role: "seller" | "buyer"): Promise<MarketplaceReceipt[]> {
  const carts = await listCartsForUser(userId, role);
  const kept = carts
    .filter((c) => RECEIPT_STATUSES.has(c.status))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const stores = await sellerStoreNames([...new Set(kept.map((c) => c.seller_id))]);
  return kept.map((c) => ({ ...c, receipt_no: receiptNo(c), store_name: stores.get(c.seller_id) ?? null }));
}


/** Plain-text receipt body — readable in chat and easy to screenshot. */
export function receiptText(r: MarketplaceReceipt, storeName?: string | null) {
  // The store name always wins over a profile/user name.
  const store = (r.store_name || storeName || "").trim();
  const lines = [
    `RECEIPT ${r.receipt_no}`,
    store ? `Store: ${store}` : null,

    `Date: ${new Date(r.created_at).toLocaleDateString()}`,
    "",
    ...r.items.map((i) => `${i.qty} x ${i.title} — ${formatPrice(i.qty * i.unit_price)}`),
    "",
    `Subtotal: ${formatPrice(r.subtotal)}`,
    r.fulfillment === "delivery" ? `Delivery (${r.delivery_address || "delivery"}): ${formatPrice(r.delivery_fee)}` : "Pickup",
    `Total: ${formatPrice(r.total)}`,
    r.note ? `Note: ${r.note}` : null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Send the receipt to the other side of the order in Messages. */
export async function sendReceipt(r: MarketplaceReceipt, myUserId: string, storeName?: string | null) {
  const otherId = myUserId === r.seller_id ? r.buyer_id : r.seller_id;
  const conversationId = await getOrCreateConversation(myUserId, otherId, { context: "marketplace" });
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: myUserId,
    content: receiptText(r, storeName),
  });
  if (error) throw new Error(error.message);
  await (supabase as any)
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
