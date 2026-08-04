import { supabase } from "@/integrations/supabase/client";
import { listMarketplaceListings, listingCoverUrl } from "@/lib/marketplace-api";
import { parsePostCaption } from "@/lib/post-editor";
import { isPurgedFeedVideoPost } from "@/lib/clear-feed-videos";
import { WheuatTv } from "@/pages/wheuat-tv/wheuatTvStore";

export type HappeningKind =
  | "post"
  | "marketplace"
  | "job"
  | "gig"
  | "tv"
  | "service"
  | "event";

export type HappeningItem = {
  id: string;
  kind: HappeningKind;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
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
  job: "Career",
  gig: "Gig",
  tv: "YAJ TV",
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

/** Aggregate newest activity from Explore destinations + regular posts. */
export async function fetchHappeningItems(opts: {
  currentUserId?: string;
  limitPerSource?: number;
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
  ] = await Promise.all([
    (supabase as any)
      .from("posts")
      .select("id, caption, media_url, media_type, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(limit),
    listMarketplaceListings({ limit, sort: "newest" }).catch(() => []),
    (supabase as any)
      .from("job_listings")
      .select("id, title, description, media, created_at, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit),
    (supabase as any)
      .from("gig_listings")
      .select("id, title, description, media, created_at, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit),
    (supabase as any)
      .from("service_listings")
      .select("id, title, description, media_url, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    (supabase as any)
      .from("event_listings")
      .select("id, title, description, media_url, media_type, address, price_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  for (const post of postsResult.data || []) {
    if (isPurgedFeedVideoPost(post)) continue;
    const { caption, meta } = parsePostCaption(post.caption);
    const title = safeTitle(meta?.title || caption?.split("\n")[0], "New post");
    items.push({
      id: `post-${post.id}`,
      kind: "post",
      title,
      subtitle: "Post",
      coverUrl: meta?.coverUrl || post.media_url || null,
      mediaType: post.media_type === "video" ? "video" : "image",
      createdAt: post.created_at,
      route: null,
      openInPostsViewer: true,
      sourceId: post.id,
    });
  }

  // Battles stay on the Posts rail only (same as a regular video post).

  for (const listing of marketResult || []) {
    items.push({
      id: `marketplace-${listing.id}`,
      kind: "marketplace",
      title: safeTitle(listing.title, "Marketplace listing"),
      subtitle: "Marketplace",
      coverUrl: listingCoverUrl(listing),
      mediaType: "image",
      createdAt: listing.created_at,
      route: `/marketplace/listing/${listing.id}`,
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

  // TV — in-memory/API list; ignore failures.
  try {
    const tvItems = await WheuatTv.list();
    for (const tv of (tvItems || []).slice(0, limit)) {
      items.push({
        id: `tv-${tv.id}`,
        kind: "tv",
        title: safeTitle(tv.title, "YAJ TV"),
        subtitle: "YAJ TV",
        coverUrl: tv.thumbUrl || null,
        mediaType: "video",
        createdAt: new Date(tv.createdAt).toISOString(),
        route: `/tv/watch?v=${tv.id}`,
        sourceId: tv.id,
      });
    }
  } catch {
    /* optional */
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
        coverUrl: row.media_url || null,
        mediaType: row.media_type === "video" ? "video" : "image",
        createdAt: row.created_at,
        route: `/events/${row.id}`,
        sourceId: row.id,
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
