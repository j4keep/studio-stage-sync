import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";
import {
  canClaimDeal,
  formatDiscountBadge,
  getDealLocationPrefs,
  haversineMiles,
  type DealFilterId,
  type DealLocationPrefs,
} from "@/lib/deals";

const sb = supabase as any;

export type DealBusiness = {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  is_verified: boolean;
  verification_status: string;
  can_publish: boolean;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  hours_json: Record<string, unknown>;
  avg_rating: number;
  review_count: number;
};

export type DealImage = {
  id: string;
  deal_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
};

export type Deal = {
  id: string;
  business_id: string;
  creator_id: string;
  title: string;
  slug: string | null;
  description: string;
  category: string;
  tags: string[] | null;
  deal_type: string;
  discount_badge: string | null;
  regular_price: number | null;
  deal_price: number | null;
  discount_value: number | null;
  currency: string;
  starts_at: string;
  expires_at: string;
  redemption_type: string;
  promo_code?: string | null;
  qr_payload?: string | null;
  barcode_value?: string | null;
  external_url: string | null;
  total_claim_limit: number | null;
  per_user_limit: number;
  claims_count: number;
  redemption_count: number;
  views_count: number;
  saves_count: number;
  location_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  map_label: string | null;
  terms: string | null;
  minimum_purchase: number | null;
  age_restriction: number | null;
  exclusions: string | null;
  status: string;
  is_featured: boolean;
  is_sponsored: boolean;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  deal_businesses?: DealBusiness | null;
  deal_images?: DealImage[] | null;
  saved?: boolean;
  distance_miles?: number | null;
  badge?: string;
};

export type DealClaim = {
  id: string;
  deal_id: string;
  user_id: string;
  business_id: string;
  status: string;
  redemption_type: string;
  redemption_code: string | null;
  qr_payload: string | null;
  barcode_value: string | null;
  claimed_at: string;
  expires_at: string | null;
  used_at: string | null;
  deals?: Deal | null;
};

export type DealReview = {
  id: string;
  deal_id: string;
  business_id: string;
  user_id: string;
  claim_id: string;
  offer_matched: number;
  redemption_easy: number;
  staff_honored: number;
  overall: number;
  body: string | null;
  business_response: string | null;
  business_responded_at: string | null;
  created_at: string;
};

export type DealNotificationPrefs = {
  user_id: string;
  saved_ending_soon: boolean;
  claimed_expiring_soon: boolean;
  followed_business_new: boolean;
  category_new: boolean;
  nearby_new: boolean;
  business_review_result: boolean;
  claim_limit_warning: boolean;
  sold_out: boolean;
};

function isMissingTableError(msg: string) {
  return /deal_|schema cache|does not exist|Could not find the table/i.test(msg);
}

export function resolveDealMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith("blob:") || u.startsWith("data:")) return null;
  if (u.includes("/storage/v1/object/public/") || u.includes("/functions/v1/r2-download")) return u;
  if (!u.startsWith("http")) {
    return getR2DownloadUrl(u.startsWith("deals/") ? u : `deals/${u}`);
  }
  return u;
}

export function dealCoverUrl(deal: Deal) {
  return (
    resolveDealMediaUrl(deal.cover_url) ||
    resolveDealMediaUrl(deal.deal_images?.find((i) => i.is_cover)?.url) ||
    resolveDealMediaUrl(deal.deal_images?.[0]?.url) ||
    null
  );
}

function attachDistance(deal: Deal, loc: DealLocationPrefs): Deal {
  let distance_miles: number | null = null;
  if (
    deal.location_type !== "online" &&
    deal.latitude != null &&
    deal.longitude != null &&
    loc.lat != null &&
    loc.lng != null
  ) {
    distance_miles = haversineMiles(loc.lat, loc.lng, deal.latitude, deal.longitude);
  }
  return {
    ...deal,
    distance_miles,
    badge: formatDiscountBadge(deal),
    deal_businesses: deal.deal_businesses || null,
  };
}

export type ListDealsOpts = {
  q?: string;
  filter?: DealFilterId | string;
  category?: string | null;
  featuredOnly?: boolean;
  businessId?: string;
  viewerId?: string | null;
  limit?: number;
  location?: DealLocationPrefs;
  includeInactiveForOwner?: boolean;
};

export async function listDeals(opts: ListDealsOpts = {}): Promise<Deal[]> {
  const loc = opts.location || getDealLocationPrefs();
  const limit = opts.limit ?? 48;

  // Best-effort cleanup; ignore until migration/RPC exists. Do not .catch() —
  // supabase.rpc() returns a builder/thenable without Promise.catch.
  await sb.rpc("expire_stale_deals");

  let query = sb
    .from("deals")
    .select("*, deal_businesses(*), deal_images(*)")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 3, 120));

  if (!opts.includeInactiveForOwner) {
    query = query.eq("status", "active");
  }
  if (opts.businessId) query = query.eq("business_id", opts.businessId);
  if (opts.featuredOnly) query = query.eq("is_featured", true);
  if (opts.category) query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message || "")) {
      const err = new Error(error.message);
      (err as any).setupNeeded = true;
      throw err;
    }
    throw error;
  }

  let rows: Deal[] = ((data as Deal[]) || []).map((d) => attachDistance(d, loc));

  const q = opts.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((d) => {
      const biz = d.deal_businesses?.name?.toLowerCase() || "";
      const tags = (d.tags || []).join(" ").toLowerCase();
      const hay = [
        d.title,
        d.description,
        d.category,
        d.city,
        d.postal_code,
        d.state,
        biz,
        tags,
        d.discount_badge,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const filter = opts.filter || "for-you";
  const now = Date.now();
  switch (filter) {
    case "near-me":
      rows = rows
        .filter((d) => d.location_type !== "online")
        .filter((d) => d.distance_miles == null || d.distance_miles <= (loc.radiusMiles || 15))
        .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));
      break;
    case "ending-soon":
      rows = rows
        .filter((d) => new Date(d.expires_at).getTime() > now)
        .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
      break;
    case "new":
      rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case "popular":
      rows = rows.sort((a, b) => (b.claims_count || 0) - (a.claims_count || 0));
      break;
    case "online":
      rows = rows.filter((d) => d.location_type === "online" || d.location_type === "both");
      break;
    case "free":
      rows = rows.filter(
        (d) =>
          d.deal_type === "free_item" ||
          Number(d.deal_price) === 0 ||
          (d.discount_badge || "").toLowerCase().includes("free"),
      );
      break;
    case "under-10":
      rows = rows.filter((d) => d.deal_price != null && Number(d.deal_price) > 0 && Number(d.deal_price) < 10);
      break;
    case "for-you":
    default:
      rows = rows.sort((a, b) => {
        const score = (d: Deal) =>
          (d.is_featured ? 100 : 0) +
          (d.is_sponsored ? 40 : 0) +
          Math.min(d.claims_count || 0, 50) -
          (d.distance_miles ?? 10);
        return score(b) - score(a);
      });
  }

  if (opts.viewerId) {
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: saves } = await sb
        .from("deal_saves")
        .select("deal_id")
        .eq("user_id", opts.viewerId)
        .in("deal_id", ids);
      const saved = new Set((saves || []).map((s: any) => s.deal_id));
      rows = rows.map((r) => ({ ...r, saved: saved.has(r.id) }));
    }
  }

  return rows.slice(0, limit);
}

export async function getDeal(id: string, viewerId?: string | null): Promise<Deal | null> {
  const loc = getDealLocationPrefs();
  const { data, error } = await sb
    .from("deals")
    .select("*, deal_businesses(*), deal_images(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let deal = attachDistance(data as Deal, loc);
  if (viewerId) {
    const { data: save } = await sb
      .from("deal_saves")
      .select("id")
      .eq("user_id", viewerId)
      .eq("deal_id", id)
      .maybeSingle();
    deal = { ...deal, saved: !!save };
  }
  void sb.rpc("increment_deal_views", { p_deal_id: id });
  return deal;
}

export async function toggleSaveDeal(userId: string, dealId: string, save: boolean) {
  if (save) {
    const { error } = await sb.from("deal_saves").upsert(
      { user_id: userId, deal_id: dealId },
      { onConflict: "deal_id,user_id" },
    );
    if (error) throw error;
    const { data } = await sb.from("deals").select("saves_count").eq("id", dealId).maybeSingle();
    if (data) {
      await sb.from("deals").update({ saves_count: (data.saves_count || 0) + 1 }).eq("id", dealId);
    }
  } else {
    const { error } = await sb.from("deal_saves").delete().eq("user_id", userId).eq("deal_id", dealId);
    if (error) throw error;
    const { data } = await sb.from("deals").select("saves_count").eq("id", dealId).maybeSingle();
    if (data) {
      await sb
        .from("deals")
        .update({ saves_count: Math.max(0, (data.saves_count || 0) - 1) })
        .eq("id", dealId);
    }
  }
}

export async function claimDeal(dealId: string): Promise<DealClaim> {
  const { data, error } = await sb.rpc("claim_deal", { p_deal_id: dealId });
  if (error) throw error;
  return data as DealClaim;
}

export async function markDealUsed(claimId: string): Promise<DealClaim> {
  const { data, error } = await sb.rpc("mark_deal_used", { p_claim_id: claimId });
  if (error) throw error;
  return data as DealClaim;
}

export async function listMyClaims(userId: string): Promise<DealClaim[]> {
  await sb.rpc("expire_stale_deals");
  const { data, error } = await sb
    .from("deal_claims")
    .select("*, deals(*, deal_businesses(*), deal_images(*))")
    .eq("user_id", userId)
    .order("claimed_at", { ascending: false });
  if (error) throw error;
  return (data as DealClaim[]) || [];
}

export async function listMySavedDeals(userId: string): Promise<Deal[]> {
  const loc = getDealLocationPrefs();
  const { data, error } = await sb
    .from("deal_saves")
    .select("deal_id, deals(*, deal_businesses(*), deal_images(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as any[])
    .map((row) => row.deals)
    .filter(Boolean)
    .map((d: Deal) => ({ ...attachDistance(d, loc), saved: true }));
}

export async function reportDeal(
  dealId: string,
  reporterId: string,
  reason: string,
  details?: string,
) {
  const { error } = await sb.from("deal_reports").insert({
    deal_id: dealId,
    reporter_id: reporterId,
    reason,
    details: details?.trim() || null,
  });
  if (error) throw error;
}

export async function submitDealReview(input: {
  dealId: string;
  businessId: string;
  userId: string;
  claimId: string;
  offerMatched: number;
  redemptionEasy: number;
  staffHonored: number;
  overall: number;
  body?: string;
}) {
  const { data, error } = await sb
    .from("deal_reviews")
    .insert({
      deal_id: input.dealId,
      business_id: input.businessId,
      user_id: input.userId,
      claim_id: input.claimId,
      offer_matched: input.offerMatched,
      redemption_easy: input.redemptionEasy,
      staff_honored: input.staffHonored,
      overall: input.overall,
      body: input.body?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Update business aggregate (best-effort, Deals-scoped only)
  const { data: revs } = await sb
    .from("deal_reviews")
    .select("overall")
    .eq("business_id", input.businessId);
  if (revs?.length) {
    const avg = revs.reduce((s: number, r: any) => s + Number(r.overall), 0) / revs.length;
    await sb
      .from("deal_businesses")
      .update({ avg_rating: Math.round(avg * 100) / 100, review_count: revs.length })
      .eq("id", input.businessId);
  }
  return data as DealReview;
}

export async function listDealReviews(dealId: string): Promise<DealReview[]> {
  const { data, error } = await sb
    .from("deal_reviews")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DealReview[]) || [];
}

export async function respondToReview(reviewId: string, businessId: string, response: string) {
  const { error } = await sb
    .from("deal_reviews")
    .update({
      business_response: response.trim(),
      business_responded_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("business_id", businessId);
  if (error) throw error;
}

export async function getOrCreateBusinessForUser(userId: string, name?: string): Promise<DealBusiness> {
  const { data: existing } = await sb
    .from("deal_businesses")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as DealBusiness;

  const { data, error } = await sb
    .from("deal_businesses")
    .insert({
      owner_id: userId,
      name: name?.trim() || "My Business",
      verification_status: "pending",
      can_publish: false,
      is_verified: false,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb.from("deal_business_members").upsert(
    {
      business_id: data.id,
      user_id: userId,
      role: "owner",
      status: "active",
    },
    { onConflict: "business_id,user_id" },
  );

  return data as DealBusiness;
}

export async function listMyBusinesses(userId: string): Promise<DealBusiness[]> {
  const { data: owned } = await sb.from("deal_businesses").select("*").eq("owner_id", userId);
  const { data: memberRows } = await sb
    .from("deal_business_members")
    .select("business_id, deal_businesses(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  const map = new Map<string, DealBusiness>();
  for (const b of (owned as DealBusiness[]) || []) map.set(b.id, b);
  for (const row of memberRows || []) {
    const b = (row as any).deal_businesses as DealBusiness | null;
    if (b) map.set(b.id, b);
  }
  return [...map.values()];
}

export async function createDealDraft(input: {
  businessId: string;
  creatorId: string;
  title: string;
  category: string;
  description: string;
  dealType: string;
  regularPrice?: number | null;
  dealPrice?: number | null;
  discountValue?: number | null;
  discountBadge?: string | null;
  startsAt: string;
  expiresAt: string;
  redemptionType: string;
  promoCode?: string | null;
  totalClaimLimit?: number | null;
  perUserLimit?: number;
  locationType: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  terms?: string | null;
  minimumPurchase?: number | null;
  ageRestriction?: number | null;
  externalUrl?: string | null;
  coverUrl?: string | null;
  tags?: string[];
}): Promise<Deal> {
  const { data, error } = await sb
    .from("deals")
    .insert({
      business_id: input.businessId,
      creator_id: input.creatorId,
      title: input.title.trim(),
      category: input.category,
      description: input.description.trim(),
      deal_type: input.dealType,
      regular_price: input.regularPrice ?? null,
      deal_price: input.dealPrice ?? null,
      discount_value: input.discountValue ?? null,
      discount_badge: input.discountBadge ?? formatDiscountBadge({
        deal_type: input.dealType,
        discount_value: input.discountValue,
        regular_price: input.regularPrice,
        deal_price: input.dealPrice,
      }),
      starts_at: input.startsAt,
      expires_at: input.expiresAt,
      redemption_type: input.redemptionType,
      promo_code: input.promoCode?.trim() || null,
      qr_payload: input.redemptionType === "qr_code" ? `yaj-deal-draft:${Date.now()}` : null,
      total_claim_limit: input.totalClaimLimit ?? null,
      per_user_limit: input.perUserLimit ?? 1,
      location_type: input.locationType,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      terms: input.terms?.trim() || null,
      minimum_purchase: input.minimumPurchase ?? null,
      age_restriction: input.ageRestriction ?? null,
      external_url: input.externalUrl?.trim() || null,
      cover_url: input.coverUrl || null,
      tags: input.tags || [],
      status: "draft",
    })
    .select("*, deal_businesses(*), deal_images(*)")
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function addDealImage(dealId: string, url: string, isCover = false) {
  const { data, error } = await sb
    .from("deal_images")
    .insert({ deal_id: dealId, url, is_cover: isCover, sort_order: 0 })
    .select("*")
    .single();
  if (error) throw error;
  if (isCover) {
    await sb.from("deals").update({ cover_url: url }).eq("id", dealId);
  }
  return data as DealImage;
}

export async function submitDeal(dealId: string): Promise<Deal> {
  const { data, error } = await sb.rpc("submit_deal_for_review", { p_deal_id: dealId });
  if (error) throw error;
  return data as Deal;
}

export async function updateDealStatus(
  dealId: string,
  status: string,
  businessId: string,
) {
  const { error } = await sb.from("deals").update({ status, updated_at: new Date().toISOString() }).eq("id", dealId).eq("business_id", businessId);
  if (error) throw error;
  await sb.from("deal_audit_log").insert({
    deal_id: dealId,
    business_id: businessId,
    action: `status_${status}`,
  });
}

export async function duplicateDeal(dealId: string, creatorId: string): Promise<Deal> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("Deal not found");
  const { id: _id, created_at: _c, updated_at: _u, claims_count: _cc, redemption_count: _rc, views_count: _v, saves_count: _s, deal_businesses: _b, deal_images: imgs, saved: _sv, distance_miles: _d, badge: _badge, ...rest } = deal as any;
  const { data, error } = await sb
    .from("deals")
    .insert({
      ...rest,
      creator_id: creatorId,
      title: `${deal.title} (Copy)`,
      status: "draft",
      claims_count: 0,
      redemption_count: 0,
      views_count: 0,
      saves_count: 0,
      is_featured: false,
      is_sponsored: false,
    })
    .select("*, deal_businesses(*), deal_images(*)")
    .single();
  if (error) throw error;
  if (imgs?.length) {
    for (const img of imgs) {
      await addDealImage(data.id, img.url, img.is_cover);
    }
  }
  return data as Deal;
}

export async function uploadDealImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const safeName = `${Date.now()}.${ext}`;
  const res = await uploadToR2(file, {
    folder: "deals",
    fileName: `${userId}/${safeName}`,
    mimeType: file.type || "image/jpeg",
  });
  if (res.success && res.data?.key) return getR2DownloadUrl(res.data.key);
  const path = `deals/${userId}/${safeName}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(res.error || error.message || "Upload failed");
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function getNotificationPrefs(userId: string): Promise<DealNotificationPrefs> {
  const { data } = await sb
    .from("deal_notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as DealNotificationPrefs;
  const defaults: DealNotificationPrefs = {
    user_id: userId,
    saved_ending_soon: true,
    claimed_expiring_soon: true,
    followed_business_new: false,
    category_new: false,
    nearby_new: false,
    business_review_result: true,
    claim_limit_warning: true,
    sold_out: true,
  };
  await sb.from("deal_notification_preferences").upsert(defaults);
  return defaults;
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<DealNotificationPrefs>,
) {
  const { error } = await sb
    .from("deal_notification_preferences")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getBusinessDashboard(businessId: string) {
  const { data: deals, error } = await sb
    .from("deals")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (deals as Deal[]) || [];
  const active = rows.filter((d) => d.status === "active");
  const totals = rows.reduce(
    (acc, d) => {
      acc.views += d.views_count || 0;
      acc.saves += d.saves_count || 0;
      acc.claims += d.claims_count || 0;
      acc.redemptions += d.redemption_count || 0;
      return acc;
    },
    { views: 0, saves: 0, claims: 0, redemptions: 0 },
  );
  return {
    deals: rows,
    active,
    totals,
    conversion: totals.views ? Math.round((totals.claims / totals.views) * 1000) / 10 : 0,
  };
}

export function dealClaimBlockedReason(deal: Deal): string | null {
  if (deal.status === "sold_out") return "This deal is sold out.";
  if (deal.status === "expired" || new Date(deal.expires_at).getTime() <= Date.now()) {
    return "This deal has expired.";
  }
  if (deal.status === "paused") return "This deal is temporarily paused.";
  if (deal.status === "pending_review") return "This deal is awaiting review.";
  if (!canClaimDeal(deal)) return "This deal cannot be claimed right now.";
  return null;
}

export { isMissingTableError };
