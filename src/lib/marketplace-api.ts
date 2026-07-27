import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2-storage";
import {
  type ListingStatus,
  type ListingType,
  sanitizeDescription,
  VEHICLE_LISTING_TYPES,
} from "@/lib/marketplace";

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
    // Strip exact coords from public payloads — keep only for owner edits
    lat: extras?.lat !== undefined ? extras.lat : undefined,
    lng: extras?.lng !== undefined ? extras.lng : undefined,
    status: row.status,
    cover_url: row.cover_url,
    tags: row.tags || [],
    attributes: row.attributes || {},
    promoted: Boolean(row.promoted),
    views_count: row.views_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media: extras?.media,
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
  const { data, error } = await (supabase as any)
    .from("marketplace_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return { ...data, member_since: data.created_at };
  }
  // Fallback to YAJ profile for display without creating yet
  const { data: yaj } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!yaj) return null;
  return {
    user_id: yaj.user_id,
    display_name: yaj.display_name,
    bio: null,
    avatar_url: yaj.avatar_url,
    city: null,
    service_area: null,
    is_business: false,
    response_time_minutes: null,
    created_at: yaj.created_at || new Date().toISOString(),
    member_since: yaj.created_at,
  };
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
  await ensureMarketplaceProfile(sellerId);
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
  input: Partial<ListingInput> & { status?: string },
): Promise<MarketplaceListing> {
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

  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .update(patch)
    .eq("id", listingId)
    .eq("seller_id", sellerId);
  if (error) throw error;

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
  return data;
}

export async function listOffersForUser(userId: string, role: "buyer" | "seller" | "both" = "both") {
  let q = (supabase as any).from("marketplace_offers").select("*").order("created_at", { ascending: false }).limit(50);
  if (role === "buyer") q = q.eq("buyer_id", userId);
  else if (role === "seller") q = q.eq("seller_id", userId);
  else q = q.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
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
  return offer;
}

export async function uploadListingImage(userId: string, file: File, onProgress?: (n: number) => void) {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await uploadToR2(file, {
    folder: "marketplace",
    fileName,
    mimeType: file.type || "image/jpeg",
    onProgress,
  });
  if (!res.success || !res.data?.url) throw new Error(res.error || "Upload failed");
  return res.data.url;
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
