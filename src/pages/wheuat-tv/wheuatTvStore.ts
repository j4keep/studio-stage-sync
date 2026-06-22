/**
 * Public WHEUAT.TV store backed by Supabase + Cloudflare R2.
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

/** Always stream through the r2-download proxy so playback works even when
 *  the R2 bucket isn't publicly readable. Falls back to whatever URL was
 *  stored on the row (legacy rows). */
function playbackUrl(videoKey: string | null, fallback: string): string {
  return videoKey ? getR2DownloadUrl(videoKey) : fallback;
}

export type WheuatTvKind = "podcast" | "short-film" | "music-video";

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
    const [likesRes, commentsRes] = await Promise.all([
      ids.length
        ? supabase.from("tv_post_likes").select("post_id, user_id").in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("tv_post_comments").select("post_id").in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const likes = (likesRes.data as any[]) || [];
    const comments = (commentsRes.data as any[]) || [];
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id || null;

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
    }));
  },

  /**
   * Publish a video to WHEUAT.TV. Uploads the blob to R2, then inserts a row
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
  }): Promise<WheuatTvItem | null> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("Sign in to publish to WHEUAT.TV");

    const ext = (input.ext || (input.blob.type.split("/")[1] || "mp4")).toLowerCase();
    const mime = input.mime || input.blob.type || "video/mp4";
    const safeTitle = input.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "video";
    const fileName = `${Date.now()}-${safeTitle}.${ext}`;
    const key = generateR2Key(user.id, "tv", fileName);

    const file = input.blob instanceof File
      ? input.blob
      : new File([input.blob], fileName, { type: mime });

    const upload = await uploadToR2(file, { folder: undefined, fileName: key, mimeType: mime });
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
        thumb_url: input.thumbDataUrl ?? null,
        mime,
        ext,
        duration_ms: input.durationMs ?? null,
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
};
