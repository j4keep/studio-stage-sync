import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/marketplace";
import { getOrCreateConversation } from "@/lib/messaging";
import { listCartsForUser, type MarketplaceCart } from "@/lib/marketplace-cart";

/** A receipt is a confirmed order — kept on file so either side can re-send it later. */
export type MarketplaceReceipt = MarketplaceCart & { receipt_no: string };

const RECEIPT_STATUSES = new Set(["approved", "ready", "completed"]);

const receiptNo = (cart: MarketplaceCart) =>
  `YAJ-${new Date(cart.created_at).toISOString().slice(0, 10).replace(/-/g, "")}-${cart.id.slice(0, 6).toUpperCase()}`;

/** Every confirmed order for this person, newest first, as receipts. */
export async function listReceipts(userId: string, role: "seller" | "buyer"): Promise<MarketplaceReceipt[]> {
  const carts = await listCartsForUser(userId, role);
  return carts
    .filter((c) => RECEIPT_STATUSES.has(c.status))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map((c) => ({ ...c, receipt_no: receiptNo(c) }));
}

/** Plain-text receipt body — readable in chat and easy to screenshot. */
export function receiptText(r: MarketplaceReceipt, storeName?: string | null) {
  const lines = [
    `RECEIPT ${r.receipt_no}`,
    storeName ? `Store: ${storeName}` : null,
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
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}
