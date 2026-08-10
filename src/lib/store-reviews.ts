import { supabase } from "@/integrations/supabase/client";
import { resolveDisplayRating, type DisplayRating } from "@/lib/ratings";

/** A buyer's rating of a $1–$5 store seller, with the seller's optional public reply. */
export type StoreReview = {
  id: string;
  cart_id: string;
  listing_id: string | null;
  seller_id: string;
  buyer_id: string;
  score: number;
  comment: string | null;
  seller_reply: string | null;
  seller_replied_at: string | null;
  created_at: string;
  buyer?: { user_id: string; display_name: string | null; avatar_url: string | null } | null;
};

/** All reviews for one store, newest first. Public — anyone can read them. */
export async function listStoreReviews(sellerId: string): Promise<StoreReview[]> {
  const { data, error } = await (supabase as any)
    .from("store_seller_reviews")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data || []) as StoreReview[];
  const ids = [...new Set(rows.map((r) => r.buyer_id))];
  if (!ids.length) return rows;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids);
  const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, buyer: map.get(r.buyer_id) || null }));
}

/** Store reputation: everyone starts at 5.0, then real ratings move the number. */
export function storeRatingFromReviews(reviews: StoreReview[]): DisplayRating {
  if (!reviews.length) return resolveDisplayRating(null, 0);
  const sum = reviews.reduce((s, r) => s + Number(r.score || 0), 0);
  return resolveDisplayRating(sum / reviews.length, reviews.length);
}

/** Compact store rating for headers without loading every comment. */
export async function fetchStoreRating(sellerId: string): Promise<DisplayRating> {
  const { data } = await (supabase as any)
    .from("store_seller_reviews")
    .select("score")
    .eq("seller_id", sellerId);
  const scores = ((data || []) as { score: number }[]).map((r) => Number(r.score)).filter(Number.isFinite);
  if (!scores.length) return resolveDisplayRating(null, 0);
  return resolveDisplayRating(scores.reduce((a, b) => a + b, 0) / scores.length, scores.length);
}

export type RateableOrder = {
  cart_id: string;
  seller_id: string;
  listing_ids: string[];
  reviewed: boolean;
};

/**
 * Orders from this seller the signed-in buyer may rate: the seller has pressed
 * Complete. The buyer's own confirmation is not required.
 */
export async function findRateableOrder(buyerId: string, sellerId: string): Promise<RateableOrder | null> {
  const { data } = await (supabase as any)
    .from("marketplace_carts")
    .select("id, seller_id, seller_completed_at")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .not("seller_completed_at", "is", null)
    .order("seller_completed_at", { ascending: false })
    .limit(5);
  const carts = (data || []) as { id: string; seller_id: string }[];
  if (!carts.length) return null;

  const { data: mine } = await (supabase as any)
    .from("store_seller_reviews")
    .select("cart_id")
    .eq("buyer_id", buyerId)
    .in(
      "cart_id",
      carts.map((c) => c.id),
    );
  const done = new Set(((mine || []) as { cart_id: string }[]).map((r) => r.cart_id));
  const open = carts.find((c) => !done.has(c.id));
  const target = open || carts[0];
  return { cart_id: target.id, seller_id: sellerId, listing_ids: [], reviewed: !open };
}

export async function submitStoreReview(input: {
  cartId: string;
  sellerId: string;
  buyerId: string;
  listingId?: string | null;
  score: number;
  comment?: string | null;
}) {
  const { error } = await (supabase as any).from("store_seller_reviews").insert({
    cart_id: input.cartId,
    seller_id: input.sellerId,
    buyer_id: input.buyerId,
    listing_id: input.listingId || null,
    score: input.score,
    comment: input.comment?.trim() || null,
  });
  if (error) throw new Error(cleanError(error.message));
}

/** Seller's public reply, social-media style, under the buyer's comment. */
export async function replyToStoreReview(reviewId: string, reply: string) {
  const { error } = await (supabase as any)
    .from("store_seller_reviews")
    .update({ seller_reply: reply.trim() || null, seller_replied_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) throw new Error(cleanError(error.message));
}

function cleanError(msg?: string) {
  const m = (msg || "Something went wrong").replace(/^.*?:\s*/, "");
  if (/row-level security/i.test(m)) return "You can only rate a seller after they complete your order";
  return m || "Something went wrong";
}

/** Cart ids the buyer has already rated, for hiding the rate button. */
export async function listMyReviewedCartIds(buyerId: string): Promise<Set<string>> {
  const { data } = await (supabase as any)
    .from("store_seller_reviews")
    .select("cart_id")
    .eq("buyer_id", buyerId);
  return new Set(((data || []) as { cart_id: string }[]).map((r) => r.cart_id));
}
