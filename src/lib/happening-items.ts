import { supabase } from "@/integrations/supabase/client";
import { listMarketplaceListings, listingCoverUrl } from "@/lib/marketplace-api";
import { parsePostCaption } from "@/lib/post-editor";
import { getLocalAreaMode, matchesLocalArea } from "@/lib/local-area";

export type HappeningKind =
  | "post"
  | "marketplace"
  | "deal"
  | "job"
  | "gig"
  | "service"
  | "event";

export type HappeningItem = {
  id: string;
  kind: HappeningKind;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
  /** Optional playable preview used by the Home Happening rail. */
  previewVideoUrl?: string | null;
  mediaType?: "image" | "video" | null;
  createdAt: string;
  /** Destination page for explore-style items. */
  route: string | null;
  /** Regular feed posts open the Posts viewer instead of leaving home. */
  openInPostsViewer?: boolean;
  sourceId: string;
};

const KIND_LABEL: Record<HappeningKind, string> = {
  post: "Post",
  marketplace: "Marketplace",
  deal: "Deal",
  job: "Job",
  gig: "Gig",
  service: "Service",
  event: "Event",
};

export function happeningKindLabel(kind: HappeningKind): string {
  return KIND_LABEL[kind] || "Happening";
}

function safeTitle(value: string | null | undefined, fallback: string) {
  const t = (value || "").trim();
  return t || fallback;
}

function isVideoMediaType(value: unknown) {
  const type = String(value || "").toLowerCase();
  return type === "video" || type.startsWith("video/");
}

async function withTimeout<T>(value: PromiseLike<T>, fallback: T, ms = 4500): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      Promise.resolve(value),
      new Promise<T>((resolve) => {
        timer = window.setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/** Aggregate newest activity from Explore destinations + regular posts. */
export async function fetchHappeningItems(opts: {
  currentUserId?: string;
  limitPerSource?: number;
  localArea?: {
    address: string | null;
    lat: number | null;
    lng: number | null;
    sharing: boolean;
  };
}): Promise<HappeningItem[]> {
  const limit = opts.limitPerSource ?? 12;
  const items: HappeningItem[] = [];

  const [
    postsResult,
    marketResult,
    jobsResult,
    gigsResult,
    servicesResult,
    eventsResult,
    dealsResult,
  ] = await Promise.all([
    withTimeout(
      (supabase as any)
        .from("posts")
        .select("id, caption, media_url, media_type, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
    withTimeout(
      listMarketplaceListings({ limit, sort: "newest", status: "active" }).catch(() => []),
      [],
    ),
    withTimeout(
      (supabase as any)
        .from("job_listings")
        .select("id, title, description, media, created_at, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
    withTimeout(
      (supabase as any)
        .from("gig_listings")
        .select("id, title, description, media, created_at, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
    withTimeout(
      (supabase as any)
        .from("service_listings")
        .select("id, title, description, media_url, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
    withTimeout(
      (supabase as any)
        .from("event_listings")
        .select("id, title, description, media_url, media_type, address, price_cents, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
    withTimeout(
      (supabase as any)
        .from("deals")
        .select("id, title, cover_url, created_at, city, state, postal_code, location_type, discount_badge")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit),
      { data: [], error: null } as any,
    ),
  ]);

  for (const post of postsResult.data || []) {
    const { caption, meta } = parsePostCaption(post.caption);
    const title = safeTitle(meta?.title || caption?.split("\n")[0], "New post");
    items.push({
      id: `post-${post.id}`,
      kind: "post",
      title,
      subtitle: "Post",
      coverUrl: meta?.coverUrl || (!isVideoMediaType(post.media_type) ? post.media_url || null : null),
      previewVideoUrl: isVideoMediaType(post.media_type) ? post.media_url || null : null,
      mediaType: isVideoMediaType(post.media_type) ? "video" : "image",
      createdAt: post.created_at,
      route: null,
      openInPostsViewer: true,
      sourceId: post.id,
    });
  }

  for (const listing of marketResult || []) {
    // $1–$5 finds live in the store product page; everything else in the listing page.
    const isDollarStore = String((listing as any).listing_type) === "five_under";
    items.push({
      id: `marketplace-${listing.id}`,
      kind: "marketplace",
      title: safeTitle(listing.title, "Marketplace listing"),
      subtitle: isDollarStore ? "$1–$5 Store" : "Marketplace",
      coverUrl: listingCoverUrl(listing),
      mediaType: "image",
      createdAt: listing.created_at,
      route: isDollarStore
        ? `/marketplace/product/${listing.id}`
        : `/marketplace/listing/${listing.id}`,
      sourceId: listing.id,
    });
  }


  for (const job of jobsResult.data || []) {
    const media = Array.isArray(job.media) ? job.media : [];
    const cover = typeof media[0] === "string" ? media[0] : media[0]?.url || null;
    items.push({
      id: `job-${job.id}`,
      kind: "job",
      title: safeTitle(job.title, "Job opening"),
      subtitle: "Career",
      coverUrl: cover,
      mediaType: "image",
      createdAt: job.created_at,
      route: `/jobs/${job.id}`,
      sourceId: job.id,
    });
  }

  for (const gig of gigsResult.data || []) {
    const media = Array.isArray(gig.media) ? gig.media : [];
    const cover = typeof media[0] === "string" ? media[0] : media[0]?.url || null;
    items.push({
      id: `gig-${gig.id}`,
      kind: "gig",
      title: safeTitle(gig.title, "Gig"),
      subtitle: "Gig",
      coverUrl: cover,
      mediaType: "image",
      createdAt: gig.created_at,
      route: `/gigs/${gig.id}`,
      sourceId: gig.id,
    });
  }

  // Services / Events — tables may not be applied yet.
  if (!servicesResult.error) {
    for (const row of servicesResult.data || []) {
      items.push({
        id: `service-${row.id}`,
        kind: "service",
        title: safeTitle(row.title, "Service"),
        subtitle: "Service",
        coverUrl: row.media_url || null,
        mediaType: "image",
        createdAt: row.created_at,
        route: `/services/${row.id}`,
        sourceId: row.id,
      });
    }
  }

  if (!eventsResult.error) {
    for (const row of eventsResult.data || []) {
      items.push({
        id: `event-${row.id}`,
        kind: "event",
        title: safeTitle(row.title, "Event"),
        subtitle: "Event",
        coverUrl: isVideoMediaType(row.media_type) ? null : row.media_url || null,
        previewVideoUrl: isVideoMediaType(row.media_type) ? row.media_url || null : null,
        mediaType: isVideoMediaType(row.media_type) ? "video" : "image",
        createdAt: row.created_at,
        route: `/events/${row.id}`,
        sourceId: row.id,
      });
    }
  }

  if (!dealsResult.error) {
    for (const row of dealsResult.data || []) {
      const isOnlineOnly = row.location_type === "online";
      const allowedByArea =
        !opts.localArea ||
        getLocalAreaMode(opts.localArea) === "anywhere" ||
        isOnlineOnly ||
        matchesLocalArea(
          [row.city, row.state, row.postal_code].filter(Boolean).join(", "),
          opts.localArea,
          row.postal_code,
        );

      if (!allowedByArea) continue;

      items.push({
        id: `deal-${row.id}`,
        kind: "deal",
        title: safeTitle(row.title, "Local deal"),
        subtitle: row.discount_badge ? `Deal · ${row.discount_badge}` : "Deal",
        coverUrl: row.cover_url || null,
        mediaType: "image",
        createdAt: row.created_at,
        route: `/deals/${row.id}`,
        sourceId: row.id,
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
