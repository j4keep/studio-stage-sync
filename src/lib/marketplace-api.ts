import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";
import {
  FIVE_UNDER_MAX,
  FIVE_UNDER_MIN,
  type ListingStatus,
  type ListingType,
  sanitizeDescription,
  VEHICLE_LISTING_TYPES,
} from "@/lib/marketplace";

function validateFiveUnderInput(input: Pick<ListingInput, "listing_type" | "price" | "quantity">) {
  if (input.listing_type !== "five_under") return;
  const price = Number(input.price);
  const quantity = Number(input.quantity);
  if (!Number.isFinite(price) || price < FIVE_UNDER_MIN || price > FIVE_UNDER_MAX) {
    throw new Error("$1–$5 Finds must be priced between $1 and $5");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Enter how many items you have in inventory");
  }
}

/** Make stored marketplace image URLs actually load in the browser. */
export function resolveMarketplaceMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith("blob:") || u.startsWith("data:")) return null;
  if (u.includes("/storage/v1/object/public/") || u.includes("/functions/v1/r2-download")) return u;
  if (!u.startsWith("http")) {
    return getR2DownloadUrl(u.startsWith("marketplace/") ? u : `marketplace/${u}`);
  }
  try {
    const parsed = new URL(u);
    const path = parsed.pathname.replace(/^\//, "");
    if (
      path.startsWith("marketplace/") ||
      parsed.hostname.includes("r2.") ||
      parsed.hostname.includes("cloudflarestorage")
    ) {
      return getR2DownloadUrl(path);
    }
  } catch {
    /* keep original */
  }
  return u;
}

export function listingCoverUrl(listing: { cover_url?: string | null; media?: { url: string }[] | null }) {
  return (
    resolveMarketplaceMediaUrl(listing.cover_url) ||
    resolveMarketplaceMediaUrl(listing.media?.[0]?.url) ||
    null
  );
}

export type MarketplaceProfile = {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  service_area: string | null;
  is_business: boolean;
  response_time_minutes: number | null;
  created_at: string;
  member_since?: string;
};

export type VehicleDetails = {
  listing_id?: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  body_style?: string | null;
  mileage?: number | null;
  vin?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  engine?: string | null;
  cylinders?: number | null;
  fuel_type?: string | null;
  exterior_color?: string | null;
  interior_color?: string | null;
  title_status?: string | null;
  motorcycle_type?: string | null;
  engine_size?: string | null;
  boat_type?: string | null;
  length_ft?: number | null;
  engine_type?: string | null;
  engine_hours?: number | null;
  hull_material?: string | null;
  trailer_included?: boolean | null;
  rv_type?: string | null;
  sleeping_capacity?: number | null;
  slide_outs?: number | null;
  dealer?: boolean;
  extras?: Record<string, unknown>;
};

export type ListingMedia = {
  id: string;
  listing_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
};

export type MarketplaceListing = {
  id: string;
  seller_id: string;
  listing_type: ListingType | string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  condition: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  quantity: number;
  price: number | null;
  firm_price: boolean;
  open_to_offers: boolean;
  delivery: boolean;
  shipping: boolean;
  local_pickup: boolean;
  city: string | null;
  state: string | null;
  zip: string | null;
  location_approx: string | null;
  /** Never expose privately unless business — API strips for public reads when not business */
  lat?: number | null;
  lng?: number | null;
  status: ListingStatus | string;
  cover_url: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  promoted: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
  /** Buyer selected when seller marked the listing sold */
  sold_to?: string | null;
  media?: ListingMedia[];
  vehicle?: VehicleDetails | null;
  seller?: MarketplaceProfile | null;
  saved?: boolean;
};

export type ListingInput = {
  listing_type: ListingType | string;
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  quantity?: number;
  price?: number | null;
  firm_price?: boolean;
  open_to_offers?: boolean;
  delivery?: boolean;
  shipping?: boolean;
  local_pickup?: boolean;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  location_approx?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: ListingStatus | string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  cover_url?: string | null;
  vehicle?: VehicleDetails | null;
  mediaUrls?: string[];
};

function mapListing(row: any, extras?: Partial<MarketplaceListing>): MarketplaceListing {
  const media = (extras?.media || []).map((m) => ({
    ...m,
    url: resolveMarketplaceMediaUrl(m.url) || m.url,
  }));
  const cover =
    resolveMarketplaceMediaUrl(row.cover_url) ||
    resolveMarketplaceMediaUrl(media[0]?.url) ||
    null;
  return {
    id: row.id,
    seller_id: row.seller_id,
    listing_type: row.listing_type,
    title: row.title,
    description: sanitizeDescription(row.description || ""),
    category: row.category,
    subcategory: row.subcategory,
    condition: row.condition,
    brand: row.brand,
    model: row.model,
    color: row.color,
    quantity: row.quantity ?? 1,
    price: row.price != null ? Number(row.price) : null,
    firm_price: Boolean(row.firm_price),
    open_to_offers: row.open_to_offers !== false,
    delivery: Boolean(row.delivery),
    shipping: Boolean(row.shipping),
    local_pickup: row.local_pickup !== false,
    city: row.city,
    state: row.state,
    zip: row.zip,
    location_approx: row.location_approx,
    lat: extras?.lat !== undefined ? extras.lat : undefined,
    lng: extras?.lng !== undefined ? extras.lng : undefined,
    status: row.status,
    cover_url: cover,
    tags: row.tags || [],
    attributes: row.attributes || {},
    promoted: Boolean(row.promoted),
    views_count: row.views_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sold_to: row.sold_to ?? null,
    media,
    vehicle: extras?.vehicle,
    seller: extras?.seller,
    saved: extras?.saved,
  };
}

export async function ensureMarketplaceProfile(userId: string): Promise<MarketplaceProfile> {
  const existing = await getMarketplaceProfile(userId);
  if (existing) return existing;

  const { data: yaj } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  const row = {
    user_id: userId,
    display_name: yaj?.display_name || "Seller",
    avatar_url: yaj?.avatar_url || null,
    bio: null,
    city: null,
    service_area: null,
    is_business: false,
  };

  const { data, error } = await (supabase as any).from("marketplace_profiles").upsert(row).select("*").single();
  if (error) throw error;
  return {
    ...data,
    member_since: data.created_at,
  };
}

export async function getMarketplaceProfile(userId: string): Promise<MarketplaceProfile | null> {
  const [{ data, error }, { data: yaj }] = await Promise.all([
    (supabase as any).from("marketplace_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("user_id, display_name, avatar_url, created_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (error && !/schema cache|does not exist/i.test(error.message || "")) throw error;

  // Always prefer live YAJ identity for name/photo — Marketplace is not a second account.
  if (data || yaj) {
    return {
      user_id: userId,
      display_name: yaj?.display_name || data?.display_name || "Member",
      bio: data?.bio ?? null,
      avatar_url: yaj?.avatar_url || data?.avatar_url || null,
      city: data?.city ?? null,
      service_area: data?.service_area ?? null,
      is_business: Boolean(data?.is_business),
      response_time_minutes: data?.response_time_minutes ?? null,
      created_at: data?.created_at || yaj?.created_at || new Date().toISOString(),
      member_since: data?.created_at || yaj?.created_at,
    };
  }
  return null;
}

export async function updateMarketplaceProfile(
  userId: string,
  patch: Partial<Pick<MarketplaceProfile, "display_name" | "bio" | "avatar_url" | "city" | "service_area" | "is_business">>,
) {
  await ensureMarketplaceProfile(userId);
  const { data, error } = await (supabase as any)
    .from("marketplace_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketplaceProfile;
}

export type ListListingsOpts = {
  category?: string;
  q?: string;
  sellerId?: string;
  status?: string | string[];
  limit?: number;
  offset?: number;
  viewerId?: string | null;
  sort?: "newest" | "price_asc" | "price_desc";
  minPrice?: number;
  maxPrice?: number;
  listingType?: string;

};

export async function listMarketplaceListings(opts: ListListingsOpts = {}): Promise<MarketplaceListing[]> {
  let q = (supabase as any)
    .from("marketplace_listings")
    .select("*")
    .is("deleted_at", null)
    .limit(opts.limit ?? 40);

  if (opts.sellerId) {
    q = q.eq("seller_id", opts.sellerId);
    if (opts.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      q = q.in("status", statuses);
    } else if (opts.viewerId && opts.viewerId === opts.sellerId) {
      // owner sees drafts too when filtering own
    } else {
      q = q.in("status", ["active", "pending", "sold"]);
    }
  } else {
    q = q.in("status", Array.isArray(opts.status) ? opts.status : opts.status ? [opts.status] : ["active", "pending"]);
  }

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.listingType) q = q.eq("listing_type", opts.listingType);
  if (opts.minPrice != null) q = q.gte("price", opts.minPrice);
  if (opts.maxPrice != null) q = q.lte("price", opts.maxPrice);

  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 40) - 1);

  if (opts.sort === "price_asc") q = q.order("price", { ascending: true, nullsFirst: false });
  else if (opts.sort === "price_desc") q = q.order("price", { ascending: false, nullsFirst: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];

  if (opts.q?.trim()) {
    const n = opts.q.trim().toLowerCase();
    rows = rows.filter(
      (r: any) =>
        (r.title || "").toLowerCase().includes(n) ||
        (r.description || "").toLowerCase().includes(n) ||
        (r.brand || "").toLowerCase().includes(n) ||
        (r.model || "").toLowerCase().includes(n) ||
        (r.city || "").toLowerCase().includes(n) ||
        (r.category || "").toLowerCase().includes(n) ||
        (r.tags || []).some((t: string) => t.toLowerCase().includes(n)),
    );
  }

  if (!rows.length) return [];

  const ids = rows.map((r: any) => r.id);
  const sellerIds = [...new Set(rows.map((r: any) => r.seller_id))];

  const [{ data: vehicles }, { data: media }, profiles, saved] = await Promise.all([
    (supabase as any).from("marketplace_vehicle_details").select("*").in("listing_id", ids),
    (supabase as any).from("marketplace_listing_media").select("*").in("listing_id", ids).order("sort_order"),
    Promise.all(sellerIds.map((id) => getMarketplaceProfile(id as string))),
    opts.viewerId
      ? (supabase as any)
          .from("marketplace_saved_listings")
          .select("listing_id")
          .eq("user_id", opts.viewerId)
          .in("listing_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const vehMap = new Map((vehicles || []).map((v: any) => [v.listing_id, v]));
  const mediaMap = new Map<string, ListingMedia[]>();
  for (const m of media || []) {
    const arr = mediaMap.get(m.listing_id) || [];
    arr.push(m);
    mediaMap.set(m.listing_id, arr);
  }
  const sellerMap = new Map(profiles.filter(Boolean).map((p) => [p!.user_id, p!]));
  const savedSet = new Set((saved?.data || []).map((s: any) => s.listing_id));

  return rows.map((r: any) =>
    mapListing(r, {
      media: mediaMap.get(r.id),
      vehicle: vehMap.get(r.id) || null,
      seller: sellerMap.get(r.seller_id) || null,
      saved: savedSet.has(r.id),
    }),
  );
}

export async function getMarketplaceListing(
  id: string,
  viewerId?: string | null,
): Promise<MarketplaceListing | null> {
  const { data, error } = await (supabase as any)
    .from("marketplace_listings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [{ data: media }, { data: vehicle }, seller, saved] = await Promise.all([
    (supabase as any)
      .from("marketplace_listing_media")
      .select("*")
      .eq("listing_id", id)
      .order("sort_order"),
    (supabase as any).from("marketplace_vehicle_details").select("*").eq("listing_id", id).maybeSingle(),
    getMarketplaceProfile(data.seller_id),
    viewerId
      ? (supabase as any)
          .from("marketplace_saved_listings")
          .select("listing_id")
          .eq("user_id", viewerId)
          .eq("listing_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isOwner = viewerId === data.seller_id;
  return mapListing(data, {
    media: media || [],
    vehicle: vehicle || null,
    seller,
    saved: Boolean(saved?.data),
    lat: isOwner || data.attributes?.public_exact_location ? data.lat : undefined,
    lng: isOwner || data.attributes?.public_exact_location ? data.lng : undefined,
  });
}

export async function createMarketplaceListing(sellerId: string, input: ListingInput): Promise<MarketplaceListing> {
  validateFiveUnderInput(input);
  try {
    await ensureMarketplaceProfile(sellerId);
  } catch {
    /* optional stats row — YAJ profile is the identity */
  }
  const cover = input.cover_url || input.mediaUrls?.[0] || null;
  const row = {
    seller_id: sellerId,
    listing_type: input.listing_type,
    title: input.title.trim(),
    description: sanitizeDescription(input.description || ""),
    category: input.category,
    subcategory: input.subcategory || null,
    condition: input.condition || null,
    brand: input.brand || null,
    model: input.model || null,
    color: input.color || null,
    quantity: input.quantity ?? 1,
    price: input.listing_type === "free" ? 0 : input.price ?? null,
    firm_price: Boolean(input.firm_price),
    open_to_offers: input.open_to_offers !== false,
    delivery: Boolean(input.delivery),
    shipping: Boolean(input.shipping),
    local_pickup: input.local_pickup !== false,
    city: input.city || null,
    state: input.state || null,
    zip: input.zip || null,
    location_approx: input.location_approx || [input.city, input.state].filter(Boolean).join(", ") || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    status: input.status || "active",
    cover_url: cover,
    tags: input.tags || [],
    attributes: input.attributes || {},
  };

  const { data, error } = await (supabase as any).from("marketplace_listings").insert(row).select("*").single();
  if (error) throw error;

  if (input.mediaUrls?.length) {
    const mediaRows = input.mediaUrls.map((url, i) => ({
      listing_id: data.id,
      url,
      sort_order: i,
      is_cover: i === 0,
    }));
    await (supabase as any).from("marketplace_listing_media").insert(mediaRows);
  }

  if (input.vehicle && VEHICLE_LISTING_TYPES.has(String(input.listing_type))) {
    await (supabase as any).from("marketplace_vehicle_details").upsert({
      listing_id: data.id,
      ...input.vehicle,
      dealer: Boolean(input.vehicle.dealer),
    });
  }

  return (await getMarketplaceListing(data.id, sellerId))!;
}

export async function updateMarketplaceListing(
  listingId: string,
  sellerId: string,
  input: Partial<ListingInput> & { status?: string; sold_to?: string | null },
): Promise<MarketplaceListing> {
  if (input.listing_type === "five_under") validateFiveUnderInput(input as ListingInput);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys = [
    "listing_type",
    "title",
    "description",
    "category",
    "subcategory",
    "condition",
    "brand",
    "model",
    "color",
    "quantity",
    "price",
    "firm_price",
    "open_to_offers",
    "delivery",
    "shipping",
    "local_pickup",
    "city",
    "state",
    "zip",
    "location_approx",
    "lat",
    "lng",
    "status",
    "tags",
    "attributes",
    "cover_url",
  ] as const;
  for (const k of keys) {
    if (input[k] !== undefined) {
      patch[k] = k === "description" ? sanitizeDescription(String(input[k] || "")) : input[k];
    }
  }
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.sold_to !== undefined) patch.sold_to = input.sold_to;

  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .update(patch)
    .eq("id", listingId)
    .eq("seller_id", sellerId);
  if (error) {
    // sold_to column may not exist yet — retry without it
    if (input.sold_to !== undefined && /sold_to/i.test(error.message || "")) {
      delete patch.sold_to;
      const retry = await (supabase as any)
        .from("marketplace_listings")
        .update(patch)
        .eq("id", listingId)
        .eq("seller_id", sellerId);
      if (retry.error) throw retry.error;
    } else {
      throw error;
    }
  }

  if (input.mediaUrls) {
    await (supabase as any).from("marketplace_listing_media").delete().eq("listing_id", listingId);
    if (input.mediaUrls.length) {
      await (supabase as any).from("marketplace_listing_media").insert(
        input.mediaUrls.map((url, i) => ({
          listing_id: listingId,
          url,
          sort_order: i,
          is_cover: i === 0,
        })),
      );
      if (!input.cover_url) {
        await (supabase as any)
          .from("marketplace_listings")
          .update({ cover_url: input.mediaUrls[0] })
          .eq("id", listingId);
      }
    }
  }

  if (input.vehicle && VEHICLE_LISTING_TYPES.has(String(input.listing_type || ""))) {
    await (supabase as any).from("marketplace_vehicle_details").upsert({
      listing_id: listingId,
      ...input.vehicle,
      dealer: Boolean(input.vehicle.dealer),
    });
  }

  return (await getMarketplaceListing(listingId, sellerId))!;
}

export async function softDeleteListing(listingId: string, sellerId: string) {
  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .update({ status: "removed", deleted_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("seller_id", sellerId);
  if (error) throw error;
}

export async function toggleSaveListing(userId: string, listingId: string, save: boolean) {
  if (save) {
    const { error } = await (supabase as any)
      .from("marketplace_saved_listings")
      .upsert({ user_id: userId, listing_id: listingId });
    if (error) throw error;
  } else {
    const { error } = await (supabase as any)
      .from("marketplace_saved_listings")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);
    if (error) throw error;
  }
}

export async function listSavedListings(userId: string): Promise<MarketplaceListing[]> {
  const { data, error } = await (supabase as any)
    .from("marketplace_saved_listings")
    .select("listing_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (data || []).map((r: any) => r.listing_id);
  if (!ids.length) return [];
  const listings = await Promise.all(ids.map((id: string) => getMarketplaceListing(id, userId)));
  return listings.filter(Boolean) as MarketplaceListing[];
}

export async function createOffer(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  message?: string;
}) {
  if (input.buyerId === input.sellerId) throw new Error("You can't offer on your own listing");
  const { data, error } = await (supabase as any)
    .from("marketplace_offers")
    .insert({
      listing_id: input.listingId,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      amount: input.amount,
      message: input.message || null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  try {
    await recordListingInquiry(input.listingId, input.buyerId, "offer");
  } catch {
    /* ignore */
  }
  return data;
}

export async function listOffersForUser(userId: string, role: "buyer" | "seller" | "both" = "both") {
  let q = (supabase as any).from("marketplace_offers").select("*").order("created_at", { ascending: false }).limit(50);
  if (role === "buyer") q = q.eq("buyer_id", userId);
  else if (role === "seller") q = q.eq("seller_id", userId);
  else q = q.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  const listingIds = [...new Set(rows.map((r: any) => String(r.listing_id)).filter(Boolean))] as string[];
  const peopleIds = [
    ...new Set(rows.flatMap((r: any) => [r.buyer_id, r.seller_id]).filter(Boolean).map(String)),
  ] as string[];

  const [{ data: listings }, { data: profiles }] = await Promise.all([
    listingIds.length
      ? (supabase as any)
          .from("marketplace_listings")
          .select("id, title, price, cover_url, city, state, location_approx, status")
          .in("id", listingIds)
      : Promise.resolve({ data: [] }),
    peopleIds.length
      ? supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", peopleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const listingMap = new Map((listings || []).map((l: any) => [l.id, l]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  return rows.map((o: any) => ({
    ...o,
    listing: listingMap.get(o.listing_id) || null,
    buyer: profileMap.get(o.buyer_id) || null,
    seller: profileMap.get(o.seller_id) || null,
  }));
}

export async function updateOfferStatus(
  offerId: string,
  userId: string,
  status: "accepted" | "declined" | "cancelled" | "countered",
  counterAmount?: number,
) {
  const { data: offer, error: fetchErr } = await (supabase as any)
    .from("marketplace_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!offer) throw new Error("Offer not found");
  if (offer.buyer_id !== userId && offer.seller_id !== userId) throw new Error("Not allowed");

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "countered" && counterAmount != null) patch.amount = counterAmount;

  const { error } = await (supabase as any).from("marketplace_offers").update(patch).eq("id", offerId);
  if (error) throw error;

  if (status === "accepted") {
    await (supabase as any)
      .from("marketplace_listings")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", offer.listing_id)
      .eq("seller_id", offer.seller_id);
  }

  // Notify the other party in Marketplace chat so buyer/seller see accept/decline clearly
  try {
    const otherId = userId === offer.seller_id ? offer.buyer_id : offer.seller_id;
    const { getOrCreateConversation } = await import("@/lib/messaging");
    const { formatPrice } = await import("@/lib/marketplace");
    const convId = await getOrCreateConversation(userId, otherId, { context: "marketplace" });
    const amountLabel = formatPrice(Number(offer.amount));
    let content = "";
    if (status === "accepted") content = `Offer update: your offer of ${amountLabel} was accepted.`;
    else if (status === "declined") content = `Offer update: your offer of ${amountLabel} was declined.`;
    else if (status === "cancelled") content = `Offer update: the offer of ${amountLabel} was cancelled.`;
    else if (status === "countered") content = `Offer update: countered at ${formatPrice(Number(counterAmount ?? offer.amount))}.`;
    if (content) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: userId,
        content,
      });
    }
  } catch {
    /* messaging is best-effort */
  }

  return { ...offer, status };
}

export type ListingInquirer = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  sources: string[];
  /** Most recent activity */
  last_at: string;
  offer_id?: string | null;
  offer_amount?: number | null;
  offer_status?: string | null;
};

/** Record that someone inquired (message / offer / comment) about a listing. */
export async function recordListingInquiry(
  listingId: string,
  userId: string,
  source: "message" | "offer" | "comment" = "message",
) {
  try {
    await (supabase as any).from("marketplace_listing_inquiries").upsert(
      {
        listing_id: listingId,
        user_id: userId,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id,user_id" },
    );
  } catch {
    /* table may not exist yet */
  }
}

/**
 * People who asked about this listing — offers, comments, and recorded chat inquiries.
 * Used when the seller marks the item sold and picks who bought it.
 */
export async function listListingInquirers(listingId: string, sellerId: string): Promise<ListingInquirer[]> {
  const byId = new Map<string, ListingInquirer>();

  const bump = (
    userId: string,
    source: string,
    at: string,
    extra?: Partial<Pick<ListingInquirer, "offer_id" | "offer_amount" | "offer_status">>,
  ) => {
    if (!userId || userId === sellerId) return;
    const cur = byId.get(userId);
    if (!cur) {
      byId.set(userId, {
        user_id: userId,
        display_name: null,
        avatar_url: null,
        sources: [source],
        last_at: at,
        offer_id: extra?.offer_id ?? null,
        offer_amount: extra?.offer_amount ?? null,
        offer_status: extra?.offer_status ?? null,
      });
      return;
    }
    if (!cur.sources.includes(source)) cur.sources.push(source);
    if (new Date(at).getTime() > new Date(cur.last_at).getTime()) cur.last_at = at;
    if (extra?.offer_id) {
      cur.offer_id = extra.offer_id;
      cur.offer_amount = extra.offer_amount ?? cur.offer_amount;
      cur.offer_status = extra.offer_status ?? cur.offer_status;
    }
  };

  const [{ data: offers }, { data: comments }, inquiriesRes] = await Promise.all([
    (supabase as any)
      .from("marketplace_offers")
      .select("id, buyer_id, amount, status, created_at, updated_at")
      .eq("listing_id", listingId)
      .eq("seller_id", sellerId)
      .order("updated_at", { ascending: false }),
    (supabase as any)
      .from("marketplace_listing_comments")
      .select("user_id, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(40),
    (supabase as any)
      .from("marketplace_listing_inquiries")
      .select("user_id, source, updated_at, created_at")
      .eq("listing_id", listingId)
      .order("updated_at", { ascending: false }),
  ]);

  for (const o of offers || []) {
    bump(o.buyer_id, "offer", o.updated_at || o.created_at, {
      offer_id: o.id,
      offer_amount: o.amount != null ? Number(o.amount) : null,
      offer_status: o.status,
    });
  }
  for (const c of comments || []) {
    bump(c.user_id, "comment", c.created_at);
  }
  if (!inquiriesRes?.error) {
    for (const i of inquiriesRes?.data || []) {
      bump(i.user_id, i.source || "message", i.updated_at || i.created_at);
    }
  }

  const ids = [...byId.keys()];
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids);
  for (const p of profiles || []) {
    const row = byId.get(p.user_id);
    if (!row) continue;
    row.display_name = p.display_name;
    row.avatar_url = p.avatar_url;
  }

  return [...byId.values()].sort((a, b) => {
    const aAccepted = a.offer_status === "accepted" ? 1 : 0;
    const bAccepted = b.offer_status === "accepted" ? 1 : 0;
    if (aAccepted !== bAccepted) return bAccepted - aAccepted;
    return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
  });
}

export async function markListingSold(
  listingId: string,
  sellerId: string,
  buyerId: string | null,
): Promise<MarketplaceListing> {
  const updated = await updateMarketplaceListing(listingId, sellerId, {
    status: "sold",
    sold_to: buyerId,
  });

  if (buyerId) {
    // Accept that buyer's pending offer if one exists (without flipping listing back to pending)
    try {
      await (supabase as any)
        .from("marketplace_offers")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("listing_id", listingId)
        .eq("buyer_id", buyerId)
        .eq("seller_id", sellerId)
        .in("status", ["pending", "countered"]);
    } catch {
      /* ignore */
    }

    try {
      const { getOrCreateConversation } = await import("@/lib/messaging");
      const convId = await getOrCreateConversation(sellerId, buyerId, { context: "marketplace" });
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: sellerId,
        content: "Marked as sold — thanks for buying on YAJ Marketplace!",
      });
    } catch {
      /* best-effort */
    }
  }

  return updated;
}

/**
 * For inbox chats: detect Marketplace peers via offers / inquiries and
 * whether the other person is the seller or the buyer from this user's POV.
 */
export async function resolveMarketplaceChatPeers(
  userId: string,
  otherUserIds: string[],
): Promise<Record<string, { peerRole: "seller" | "buyer" }>> {
  const out: Record<string, { peerRole: "seller" | "buyer" }> = {};
  const ids = [...new Set(otherUserIds.filter(Boolean))];
  if (!ids.length) return out;

  try {
    const [{ data: asBuyer }, { data: asSeller }] = await Promise.all([
      (supabase as any)
        .from("marketplace_offers")
        .select("seller_id, updated_at")
        .eq("buyer_id", userId)
        .in("seller_id", ids),
      (supabase as any)
        .from("marketplace_offers")
        .select("buyer_id, updated_at")
        .eq("seller_id", userId)
        .in("buyer_id", ids),
    ]);
    for (const o of asBuyer || []) {
      if (o?.seller_id) out[o.seller_id] = { peerRole: "seller" };
    }
    for (const o of asSeller || []) {
      if (o?.buyer_id && !out[o.buyer_id]) out[o.buyer_id] = { peerRole: "buyer" };
    }
  } catch {
    /* offers table may be unavailable */
  }

  try {
    const { data: myListings } = await (supabase as any)
      .from("marketplace_listings")
      .select("id")
      .eq("seller_id", userId)
      .limit(80);
    const listingIds = (myListings || []).map((l: { id: string }) => l.id);
    if (listingIds.length) {
      const { data: inqs, error } = await (supabase as any)
        .from("marketplace_listing_inquiries")
        .select("user_id")
        .in("listing_id", listingIds)
        .in("user_id", ids);
      if (!error) {
        for (const i of inqs || []) {
          if (i?.user_id && !out[i.user_id]) out[i.user_id] = { peerRole: "buyer" };
        }
      }
    }
  } catch {
    /* inquiries may not exist yet */
  }

  try {
    const { data: myInqs, error } = await (supabase as any)
      .from("marketplace_listing_inquiries")
      .select("listing_id")
      .eq("user_id", userId)
      .limit(80);
    if (!error && myInqs?.length) {
      const listingIds = [...new Set(myInqs.map((i: { listing_id: string }) => i.listing_id))];
      const { data: listings } = await (supabase as any)
        .from("marketplace_listings")
        .select("id, seller_id")
        .in("id", listingIds)
        .in("seller_id", ids);
      for (const l of listings || []) {
        if (l?.seller_id && !out[l.seller_id]) out[l.seller_id] = { peerRole: "seller" };
      }
    }
  } catch {
    /* ignore */
  }

  return out;
}

export async function uploadListingImage(userId: string, file: File, onProgress?: (n: number) => void) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext === "heic" || ext === "heif" ? "jpg" : ext}`;
  const mime = file.type || "image/jpeg";

  // Prefer public Supabase storage (same path Local Help uses) so buyers can load images.
  try {
    onProgress?.(10);
    const path = `marketplace/${userId}/${safeName}`;
    const { error } = await supabase.storage.from("media").upload(path, file, {
      upsert: true,
      contentType: mime,
    });
    if (!error) {
      onProgress?.(100);
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      if (pub?.publicUrl) return pub.publicUrl;
    }
  } catch {
    /* fall through to R2 */
  }

  const res = await uploadToR2(file, {
    folder: "marketplace",
    fileName: `${userId}/${safeName}`,
    mimeType: mime,
    onProgress,
  });
  if (!res.success || !res.data?.key) throw new Error(res.error || "Upload failed");
  // Direct R2 URLs are often private — always serve via r2-download proxy.
  return getR2DownloadUrl(res.data.key);
}

/** Compress image client-side before upload (keeps quality reasonable). */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
