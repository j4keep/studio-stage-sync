/**
 * Public YAJ.TV store backed by Supabase + Cloudflare R2.
 *
 * Anyone (signed-in or anon) can list/watch posts.
 * Authenticated users can publish/like/comment/delete their own.
 *
 * Each post stores: kind, title, optional description, video URL on R2,
 * optional thumbnail, plus the creator's full profile (display name + avatar)
 * joined from `profiles`.
 */

import { supabase } from "@/integrations/supabase/client";
import { uploadToR2, deleteFromR2, generateR2Key, getR2DownloadUrl } from "@/lib/r2-storage";
import { captureVideoPosterFromBlob, dataUrlToFile } from "@/lib/video-preview";

/** Always stream through the r2-download proxy so playback works even when
 *  the R2 bucket isn't publicly readable. Falls back to whatever URL was
 *  stored on the row (legacy rows). */
function playbackUrl(videoKey: string | null, fallback: string): string {
  return videoKey ? getR2DownloadUrl(videoKey) : fallback;
}

export type WheuatTvKind = "podcast" | "short-film" | "music-video";

/**
 * Browse categories for the streaming-style home screen. Distinct from
 * `kind`, which stays the original upload classification. Legacy rows
 * without a stored category fall back to KIND_TO_CATEGORY below so old
 * content still shows up in the right rows.
 */
export type WheuatTvCategory =
  | "short-films"
  | "podcasts"
  | "music-videos"
  | "documentaries"
  | "comedy"
  | "drama"
  | "lifestyle"
  | "interviews"
  | "creator-originals";

export const KIND_TO_CATEGORY: Record<WheuatTvKind, WheuatTvCategory> = {
  "short-film": "short-films",
  podcast: "podcasts",
  "music-video": "music-videos",
};

export interface WheuatTvCreator {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WheuatTvItem {
  id: string;
  kind: WheuatTvKind;
  title: string;
  description: string | null;
  videoUrl: string;
  videoKey: string | null;
  thumbUrl: string | null;
  mime: string | null;
  ext: string | null;
  durationMs: number | null;
  createdAt: number;
  creator: WheuatTvCreator;
  likes: number;
  likedByMe: boolean;
  commentCount: number;
  /** Streaming-catalog metadata. All optional/backward-compatible. */
  category: WheuatTvCategory | string | null;
  genre: string | null;
  isFeatured: boolean;
  isTrending: boolean;
  isOriginal: boolean;
  /** false for seeded/demo catalog entries that have no real video file yet. */
  hasMedia: boolean;
  releaseDate: number | null;
  views: number;
  rating: number | null;
  maturityRating: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  inMyList: boolean;
  /** "subscribers" titles require WheuatTv.isSubscribedToCreator(creator.id) (or being the
   *  creator) before playback — checked on the detail page, not baked into every list row. */
  accessTier: "free" | "subscribers";
  seriesTitle: string | null;
  episodeNumber: number | null;
}

/** Category the item should appear under in a "by category" browse row. */
export function effectiveCategory(item: Pick<WheuatTvItem, "category" | "kind">): WheuatTvCategory | string {
  return item.category || KIND_TO_CATEGORY[item.kind];
}

export interface WheuatTvComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
  author: WheuatTvCreator;
}

type ProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null };

function emitUpdate() {
  try {
    window.dispatchEvent(new CustomEvent("wheuat-tv-updated"));
  } catch {}
}

async function fetchProfileMap(userIds: string[]): Promise<Record<string, ProfileRow>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return {};
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", unique);
  const map: Record<string, ProfileRow> = {};
  (data || []).forEach((p) => {
    map[p.user_id] = p as ProfileRow;
  });
  return map;
}

function creatorOf(userId: string, p: ProfileRow | undefined): WheuatTvCreator {
  return {
    id: userId,
    displayName: p?.display_name?.trim() || "Creator",
    avatarUrl: p?.avatar_url || null,
  };
}

async function uploadThumbDataUrl(userId: string, dataUrl: string, title: string) {
  const safeTitle = title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 50) || "cover";
  const file = dataUrlToFile(dataUrl, `${Date.now()}-${safeTitle}.jpg`);
  const key = generateR2Key(userId, "tv-thumb", file.name);
  const up = await uploadToR2(file, { folder: undefined, fileName: key, mimeType: file.type || "image/jpeg" });
  if (!up.success || !up.data) throw new Error(up.error || "Cover upload failed");
  return getR2DownloadUrl(up.data.key);
}

export const WheuatTv = {
  /** List every public post, newest first. Includes creator profile + like state for the current user. */
  async list(): Promise<WheuatTvItem[]> {
    const { data: posts, error } = await supabase
      .from("tv_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !posts) return [];

    const userIds = posts.map((p: any) => p.user_id);
    const profiles = await fetchProfileMap(userIds);

    // Likes + comment counts in two cheap queries.
    const ids = posts.map((p: any) => p.id);
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id || null;
    const [likesRes, commentsRes, myListRes] = await Promise.all([
      ids.length
        ? supabase.from("tv_post_likes").select("post_id, user_id").in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("tv_post_comments").select("post_id").in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length && me
        ? supabase.from("tv_watchlist").select("post_id").eq("user_id", me).in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const likes = (likesRes.data as any[]) || [];
    const comments = (commentsRes.data as any[]) || [];
    const myListIds = new Set(((myListRes.data as any[]) || []).map((r) => r.post_id));

    const likesByPost: Record<string, { count: number; mine: boolean }> = {};
    likes.forEach((l) => {
      const slot = (likesByPost[l.post_id] ||= { count: 0, mine: false });
      slot.count += 1;
      if (me && l.user_id === me) slot.mine = true;
    });
    const commentsByPost: Record<string, number> = {};
    comments.forEach((c) => {
      commentsByPost[c.post_id] = (commentsByPost[c.post_id] || 0) + 1;
    });

    return posts.map((p: any): WheuatTvItem => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      description: p.description,
      videoUrl: playbackUrl(p.video_key, p.video_url),
      videoKey: p.video_key,
      thumbUrl: p.thumb_url,
      mime: p.mime,
      ext: p.ext,
      durationMs: p.duration_ms,
      createdAt: new Date(p.created_at).getTime(),
      creator: creatorOf(p.user_id, profiles[p.user_id]),
      likes: likesByPost[p.id]?.count || 0,
      likedByMe: !!likesByPost[p.id]?.mine,
      commentCount: commentsByPost[p.id] || 0,
      category: p.category ?? null,
      genre: p.genre ?? null,
      isFeatured: !!p.is_featured,
      isTrending: !!p.is_trending,
      isOriginal: !!p.is_original,
      hasMedia: p.has_media ?? true,
      releaseDate: p.release_date ? new Date(p.release_date).getTime() : null,
      views: p.views ?? 0,
      rating: p.rating ?? null,
      maturityRating: p.maturity_rating ?? null,
      posterUrl: p.poster_url ?? null,
      backdropUrl: p.backdrop_url ?? null,
      inMyList: myListIds.has(p.id),
      accessTier: p.access_tier === "subscribers" ? "subscribers" : "free",
      seriesTitle: p.series_title ?? null,
      episodeNumber: p.episode_number ?? null,
    }));
  },

  /**
   * Publish a video to YAJ.TV. Uploads the blob to R2, then inserts a row
   * so it becomes visible to every user on every device.
   */
  async publish(input: {
    kind: WheuatTvKind;
    title: string;
    description?: string;
    blob: Blob;
    mime?: string;
    ext?: string;
    durationMs?: number;
    thumbDataUrl?: string;
    /** User-picked cover image. Takes priority over any auto-captured video frame. */
    coverFile?: File | null;
    /** Streaming-catalog category (Drama, Comedy, Kids, Action, …). */
    category?: string;
    accessTier?: "free" | "subscribers";
    /** Group this upload as an episode of a series sharing the same title. */
    seriesTitle?: string | null;
    episodeNumber?: number | null;
  }): Promise<WheuatTvItem | null> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("Sign in to publish to YAJ.TV");

    const ext = (input.ext || (input.blob.type.split("/")[1] || "mp4")).toLowerCase();
    const mime = input.mime || input.blob.type || "video/mp4";
    const safeTitle = input.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "video";
    const fileName = `${Date.now()}-${safeTitle}.${ext}`;
    const key = generateR2Key(user.id, "tv", fileName);

    const file = input.blob instanceof File
      ? input.blob
      : new File([input.blob], fileName, { type: mime });

    // Video + cover upload run concurrently — sequential round trips here nearly
    // doubled perceived "Uploading…" time once cover pictures were added.
    const coverFile = input.coverFile;
    const [upload, thumbUrl] = await Promise.all([
      uploadToR2(file, { folder: undefined, fileName: key, mimeType: mime }),
      (async (): Promise<string | null> => {
        if (coverFile) {
          const coverKey = generateR2Key(user.id, "tv-thumb", coverFile.name);
          const coverUpload = await uploadToR2(coverFile, {
            folder: undefined,
            fileName: coverKey,
            mimeType: coverFile.type || "image/jpeg",
          }).catch(() => null);
          if (coverUpload?.success && coverUpload.data) return getR2DownloadUrl(coverUpload.data.key);
        }
        const thumbDataUrl = input.thumbDataUrl || (await captureVideoPosterFromBlob(input.blob).catch(() => null));
        return thumbDataUrl ? await uploadThumbDataUrl(user.id, thumbDataUrl, input.title).catch(() => null) : null;
      })(),
    ]);
    if (!upload.success || !upload.data) {
      throw new Error(upload.error || "Upload to storage failed");
    }

    const { data, error } = await supabase
      .from("tv_posts")
      .insert({
        user_id: user.id,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        video_url: upload.data.url,
        video_key: upload.data.key,
        thumb_url: thumbUrl,
        mime,
        ext,
        duration_ms: input.durationMs ?? null,
        category: input.category ?? null,
        access_tier: input.accessTier ?? "free",
        series_title: input.seriesTitle?.trim() || null,
        episode_number: input.episodeNumber ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw error || new Error("Insert failed");

    emitUpdate();
    const profileMap = await fetchProfileMap([user.id]);
    return {
      id: data.id,
      kind: data.kind as WheuatTvKind,
      title: data.title,
      description: data.description,
      videoUrl: playbackUrl(data.video_key, data.video_url),
      videoKey: data.video_key,
      thumbUrl: data.thumb_url,
      mime: data.mime,
      ext: data.ext,
      durationMs: data.duration_ms,
      createdAt: new Date(data.created_at).getTime(),
      creator: creatorOf(user.id, profileMap[user.id]),
      likes: 0,
      likedByMe: false,
      commentCount: 0,
      category: data.category ?? null,
      genre: data.genre ?? null,
      isFeatured: !!data.is_featured,
      isTrending: !!data.is_trending,
      isOriginal: !!data.is_original,
      hasMedia: data.has_media ?? true,
      releaseDate: data.release_date ? new Date(data.release_date).getTime() : null,
      views: data.views ?? 0,
      rating: data.rating ?? null,
      maturityRating: data.maturity_rating ?? null,
      posterUrl: data.poster_url ?? null,
      backdropUrl: data.backdrop_url ?? null,
      inMyList: false,
      accessTier: data.access_tier === "subscribers" ? "subscribers" : "free",
      seriesTitle: data.series_title ?? null,
      episodeNumber: data.episode_number ?? null,
    };
  },

  /** Back-compat alias for existing publish call sites. */
  async add(input: {
    kind: WheuatTvKind;
    title: string;
    description?: string;
    blob: Blob;
    mime?: string;
    ext?: string;
    durationMs?: number;
    thumbDataUrl?: string;
    // Legacy fields, no longer used:
    uploaderId?: string;
    uploaderName?: string;
    id?: string;
  }): Promise<WheuatTvItem | null> {
    return this.publish(input);
  },

  async remove(id: string, videoKey: string | null) {
    if (videoKey) {
      // Best-effort R2 cleanup; ignore failures so the row still goes away.
      await deleteFromR2(videoKey).catch(() => {});
    }
    await supabase.from("tv_posts").delete().eq("id", id);
    emitUpdate();
  },

  async rename(id: string, title: string) {
    await supabase.from("tv_posts").update({ title }).eq("id", id);
    emitUpdate();
  },

  /** Update title/subtitle (description) and optionally upload a new cover image. */
  async updateMeta(
    id: string,
    input: {
      title?: string;
      description?: string | null;
      coverFile?: File | null;
      accessTier?: "free" | "subscribers";
    },
  ): Promise<void> {
    const patch: Record<string, any> = {};
    if (typeof input.title === "string") patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.accessTier) patch.access_tier = input.accessTier;

    if (input.coverFile) {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Sign in to update cover");
      const ext = (input.coverFile.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${Date.now()}-cover.${ext}`;
      const key = generateR2Key(user.id, "tv-thumb", fileName);
      const up = await uploadToR2(input.coverFile, {
        folder: undefined,
        fileName: key,
        mimeType: input.coverFile.type || "image/jpeg",
      });
      if (!up.success || !up.data) throw new Error(up.error || "Cover upload failed");
      patch.thumb_url = getR2DownloadUrl(up.data.key);
    }

    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from("tv_posts").update(patch).eq("id", id);
    if (error) throw error;
    emitUpdate();
  },

  async toggleLike(id: string) {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return;
    const { data: existing } = await supabase
      .from("tv_post_likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", me)
      .maybeSingle();
    if (existing) {
      await supabase.from("tv_post_likes").delete().eq("post_id", id).eq("user_id", me);
    } else {
      await supabase.from("tv_post_likes").insert({ post_id: id, user_id: me });
    }
    emitUpdate();
  },

  async listComments(id: string): Promise<WheuatTvComment[]> {
    const { data } = await supabase
      .from("tv_post_comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    const rows = (data as any[]) || [];
    const profiles = await fetchProfileMap(rows.map((r) => r.user_id));
    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      userId: r.user_id,
      text: r.text,
      createdAt: new Date(r.created_at).getTime(),
      author: creatorOf(r.user_id, profiles[r.user_id]),
    }));
  },

  async addComment(id: string, text: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) throw new Error("Sign in to comment");
    await supabase.from("tv_post_comments").insert({ post_id: id, user_id: me, text });
    emitUpdate();
  },

  /** URL to play. Already public on R2. */
  async getUrl(_id: string): Promise<string | null> {
    return null; // unused now; the item already exposes videoUrl directly
  },

  /** Fire-and-forget view counter bump. Safe for anon viewers too. */
  async recordView(id: string): Promise<void> {
    // supabase.rpc() returns a builder/thenable without Promise.catch — use try/catch instead.
    try {
      await supabase.rpc("increment_tv_post_views", { p_post_id: id });
    } catch {
      /* best-effort; safe to ignore pre-migration or offline */
    }
  },

  async isInWatchlist(id: string): Promise<boolean> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return false;
    const { data } = await supabase
      .from("tv_watchlist")
      .select("post_id")
      .eq("user_id", me)
      .eq("post_id", id)
      .maybeSingle();
    return !!data;
  },

  async addToWatchlist(id: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) throw new Error("Sign in to save to My List");
    await supabase.from("tv_watchlist").insert({ user_id: me, post_id: id });
    emitUpdate();
  },

  async removeFromWatchlist(id: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return;
    await supabase.from("tv_watchlist").delete().eq("user_id", me).eq("post_id", id);
    emitUpdate();
  },

  async toggleWatchlist(id: string, currentlyInList: boolean): Promise<void> {
    if (currentlyInList) await this.removeFromWatchlist(id);
    else await this.addToWatchlist(id);
  },

  /** Full My List, newest-saved first. Empty (not an error) when signed out. */
  async listWatchlist(): Promise<WheuatTvItem[]> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return [];
    const { data: rows } = await supabase
      .from("tv_watchlist")
      .select("post_id, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    const order = (rows || []).map((r: any) => r.post_id as string);
    if (!order.length) return [];
    const all = await this.list();
    const byId = new Map(all.map((i) => [i.id, i]));
    return order.map((id) => byId.get(id)).filter((i): i is WheuatTvItem => !!i);
  },

  /** Client-side search across title, description, creator and category. */
  search(items: WheuatTvItem[], query: string): WheuatTvItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const category = String(effectiveCategory(i)).toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        i.creator.displayName.toLowerCase().includes(q) ||
        category.includes(q) ||
        (i.genre || "").toLowerCase().includes(q)
      );
    });
  },

  /**
   * Support tab for uploaded/original content only — never available on Live TV.
   * Preview/ledger only (no real payment processor wired in yet), same "preview
   * until billing" pattern as the existing Circle donation tab.
   */
  async donate(postId: string, toUserId: string, amountCents: number): Promise<void> {
    if (amountCents <= 0) throw new Error("Invalid amount");
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) throw new Error("Sign in to support this creator");
    if (me === toUserId) throw new Error("This is your own upload");
    const { error } = await supabase
      .from("tv_post_donations")
      .insert({ post_id: postId, from_user_id: me, to_user_id: toUserId, amount_cents: amountCents });
    if (error) throw error;
  },

  /** Does the current viewer already have access to this creator's "Subscribers Only" titles? */
  async isSubscribedToCreator(creatorId: string): Promise<boolean> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return false;
    if (me === creatorId) return true;
    const { data } = await supabase
      .from("tv_creator_subscriptions")
      .select("creator_id")
      .eq("subscriber_id", me)
      .eq("creator_id", creatorId)
      .maybeSingle();
    return !!data;
  },

  /** Free to subscribe for now — preview/ledger access relationship, no payment processor yet. */
  async subscribeToCreator(creatorId: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) throw new Error("Sign in to subscribe");
    if (me === creatorId) return;
    const { error } = await supabase.from("tv_creator_subscriptions").insert({ subscriber_id: me, creator_id: creatorId });
    if (error) throw error;
  },

  async unsubscribeFromCreator(creatorId: string): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return;
    await supabase.from("tv_creator_subscriptions").delete().eq("subscriber_id", me).eq("creator_id", creatorId);
  },

  /** Other episodes in the same series (same creator, same series title), episode order. */
  listEpisodes(allItems: WheuatTvItem[], item: WheuatTvItem): WheuatTvItem[] {
    if (!item.seriesTitle) return [];
    const series = item.seriesTitle.trim().toLowerCase();
    return allItems
      .filter((i) => i.creator.id === item.creator.id && i.seriesTitle?.trim().toLowerCase() === series)
      .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0) || a.createdAt - b.createdAt);
  },
};
