/**
 * My Circle exclusive content — posts & videos stay inside the circle
 * (never shared to the main YAJ feed).
 *
 * Prefers Supabase `circle_contents` tables; falls back to localStorage when
 * the migration isn't applied yet so the UI still works in preview.
 */

import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const LOCAL_KEY = "yaj.circle.contents.v1";

export type CircleContentKind = "post" | "video";
export type CircleActivityType = "photo" | "event" | "community" | "update" | "exclusive" | "video";
export type CircleContentVisibility = "circle_members" | "paid_members" | "only_me" | "public_in_circle";

export type CircleContent = {
  id: string;
  circle_id: string;
  author_id: string;
  kind: CircleContentKind;
  activity_type: CircleActivityType;
  title: string | null;
  body: string | null;
  media_urls: string[];
  media_type: "image" | "video" | "none";
  visibility: CircleContentVisibility;
  donations_enabled: boolean;
  like_count: number;
  view_count: number;
  comment_count: number;
  event_at: string | null;
  event_location: string | null;
  created_at: string;
  updated_at: string;
  /** Client-only */
  liked_by_me?: boolean;
};

export type CircleContentComment = {
  id: string;
  content_id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export const ACTIVITY_META: Record<
  Exclude<CircleActivityType, "video">,
  { label: string; hint: string }
> = {
  photo: { label: "Photo", hint: "Share a picture with your circle" },
  event: { label: "Event", hint: "Announce a meetup or drop" },
  community: { label: "Community", hint: "Activities & hangouts" },
  update: { label: "Update", hint: "A quick note for members" },
  exclusive: { label: "Exclusive", hint: "Members-only drop" },
};

export const VISIBILITY_META: Record<CircleContentVisibility, { label: string; hint: string }> = {
  circle_members: { label: "Circle members", hint: "Approved members only" },
  paid_members: { label: "Subscribers", hint: "Paid members only" },
  only_me: { label: "Only me", hint: "Private draft / personal" },
  public_in_circle: { label: "Circle page", hint: "Anyone who can open this Circle" },
};

type LocalStore = Record<string, CircleContent[]>;
type LocalLikes = Record<string, string[]>; // contentId -> userIds
type LocalComments = Record<string, CircleContentComment[]>;

function readLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalStore;
  } catch {
    return {};
  }
}

function writeLocal(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function readLocalLikes(): LocalLikes {
  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_KEY}.likes`) || "{}") as LocalLikes;
  } catch {
    return {};
  }
}

function writeLocalLikes(likes: LocalLikes) {
  localStorage.setItem(`${LOCAL_KEY}.likes`, JSON.stringify(likes));
}

function readLocalComments(): LocalComments {
  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_KEY}.comments`) || "{}") as LocalComments;
  } catch {
    return {};
  }
}

function writeLocalComments(comments: LocalComments) {
  localStorage.setItem(`${LOCAL_KEY}.comments`, JSON.stringify(comments));
}

function isMissingTable(err: unknown): boolean {
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : String(err ?? "");
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  return code === "42P01" || /circle_contents|does not exist|schema cache|Could not find/i.test(msg);
}

export type CreateCircleContentInput = {
  circleId: string;
  authorId: string;
  kind: CircleContentKind;
  activityType: CircleActivityType;
  title?: string;
  body?: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video" | "none";
  visibility?: CircleContentVisibility;
  donationsEnabled?: boolean;
  eventAt?: string | null;
  eventLocation?: string | null;
};

function toRow(input: CreateCircleContentInput): CircleContent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    circle_id: input.circleId,
    author_id: input.authorId,
    kind: input.kind,
    activity_type: input.activityType,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    media_urls: input.mediaUrls ?? [],
    media_type: input.mediaType ?? "none",
    visibility: input.visibility ?? "circle_members",
    donations_enabled: input.donationsEnabled !== false,
    like_count: 0,
    view_count: 0,
    comment_count: 0,
    event_at: input.eventAt ?? null,
    event_location: input.eventLocation ?? null,
    created_at: now,
    updated_at: now,
  };
}

export async function createCircleContent(input: CreateCircleContentInput): Promise<CircleContent> {
  const row = {
    circle_id: input.circleId,
    author_id: input.authorId,
    kind: input.kind,
    activity_type: input.activityType,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    media_urls: input.mediaUrls ?? [],
    media_type: input.mediaType ?? "none",
    visibility: input.visibility ?? "circle_members",
    donations_enabled: input.donationsEnabled !== false,
    event_at: input.eventAt ?? null,
    event_location: input.eventLocation ?? null,
  };

  try {
    const { data, error } = await sb.from("circle_contents").insert(row).select("*").single();
    if (error) throw error;
    return data as CircleContent;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const local = toRow(input);
    const store = readLocal();
    store[input.circleId] = [local, ...(store[input.circleId] ?? [])];
    writeLocal(store);
    return local;
  }
}

export async function listCircleContents(
  circleId: string,
  opts: { kind?: CircleContentKind; userId?: string } = {},
): Promise<CircleContent[]> {
  try {
    let q = sb.from("circle_contents").select("*").eq("circle_id", circleId).order("created_at", { ascending: false });
    if (opts.kind) q = q.eq("kind", opts.kind);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as CircleContent[]) || [];
    if (!opts.userId || !rows.length) return rows;

    const ids = rows.map((r) => r.id);
    const { data: likes } = await sb
      .from("circle_content_likes")
      .select("content_id")
      .eq("user_id", opts.userId)
      .in("content_id", ids);
    const liked = new Set(((likes as { content_id: string }[]) || []).map((l) => l.content_id));
    return rows.map((r) => ({ ...r, liked_by_me: liked.has(r.id) }));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const store = readLocal();
    let rows = store[circleId] ?? [];
    if (opts.kind) rows = rows.filter((r) => r.kind === opts.kind);
    const likes = readLocalLikes();
    return rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({
        ...r,
        liked_by_me: opts.userId ? (likes[r.id] ?? []).includes(opts.userId) : false,
      }));
  }
}

export async function toggleCircleContentLike(contentId: string, userId: string, circleId: string): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("toggle_circle_content_like", { p_content_id: contentId });
    if (error) throw error;
    return Boolean(data);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const likes = readLocalLikes();
    const set = new Set(likes[contentId] ?? []);
    let liked: boolean;
    if (set.has(userId)) {
      set.delete(userId);
      liked = false;
    } else {
      set.add(userId);
      liked = true;
    }
    likes[contentId] = [...set];
    writeLocalLikes(likes);
    const store = readLocal();
    const list = store[circleId] ?? [];
    store[circleId] = list.map((c) =>
      c.id === contentId
        ? { ...c, like_count: Math.max(0, c.like_count + (liked ? 1 : -1)), updated_at: new Date().toISOString() }
        : c,
    );
    writeLocal(store);
    return liked;
  }
}

export async function recordCircleContentView(contentId: string, circleId: string): Promise<void> {
  try {
    const { error } = await sb.rpc("increment_circle_content_views", { p_content_id: contentId });
    if (error) throw error;
  } catch (err) {
    if (!isMissingTable(err)) return;
    const store = readLocal();
    const list = store[circleId] ?? [];
    store[circleId] = list.map((c) => (c.id === contentId ? { ...c, view_count: c.view_count + 1 } : c));
    writeLocal(store);
  }
}

export async function listCircleContentComments(contentId: string): Promise<CircleContentComment[]> {
  try {
    const { data, error } = await sb
      .from("circle_content_comments")
      .select("id, content_id, user_id, body, created_at")
      .eq("content_id", contentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data as CircleContentComment[]) || [];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (!ids.length) return rows;
    const { data: profiles } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
    const map = new Map(
      ((profiles as { user_id: string; display_name: string | null; avatar_url: string | null }[]) || []).map((p) => [
        p.user_id,
        p,
      ]),
    );
    return rows.map((r) => ({
      ...r,
      display_name: map.get(r.user_id)?.display_name ?? null,
      avatar_url: map.get(r.user_id)?.avatar_url ?? null,
    }));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return readLocalComments()[contentId] ?? [];
  }
}

export async function addCircleContentComment(
  contentId: string,
  userId: string,
  body: string,
  circleId: string,
): Promise<CircleContentComment> {
  const text = body.trim();
  if (!text) throw new Error("Comment is empty");

  try {
    const { data, error } = await sb
      .from("circle_content_comments")
      .insert({ content_id: contentId, user_id: userId, body: text })
      .select("*")
      .single();
    if (error) throw error;
    const { data: row } = await sb.from("circle_contents").select("comment_count").eq("id", contentId).maybeSingle();
    if (row) {
      await sb
        .from("circle_contents")
        .update({ comment_count: (row.comment_count ?? 0) + 1 })
        .eq("id", contentId);
    }
    return data as CircleContentComment;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const comment: CircleContentComment = {
      id: crypto.randomUUID(),
      content_id: contentId,
      user_id: userId,
      body: text,
      created_at: new Date().toISOString(),
    };
    const comments = readLocalComments();
    comments[contentId] = [...(comments[contentId] ?? []), comment];
    writeLocalComments(comments);
    const store = readLocal();
    store[circleId] = (store[circleId] ?? []).map((c) =>
      c.id === contentId ? { ...c, comment_count: c.comment_count + 1 } : c,
    );
    writeLocal(store);
    return comment;
  }
}

export async function donateToCircleContent(
  contentId: string,
  fromUserId: string,
  amountCents: number,
): Promise<void> {
  if (amountCents <= 0) throw new Error("Invalid amount");
  try {
    const { error } = await sb.from("circle_content_donations").insert({
      content_id: contentId,
      from_user_id: fromUserId,
      amount_cents: amountCents,
    });
    if (error) throw error;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    // Soft-record locally so the UI can confirm the gesture.
    const key = `${LOCAL_KEY}.donations`;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
      raw.push({ contentId, fromUserId, amountCents, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(raw));
    } catch {
      /* ignore */
    }
  }
}

export async function uploadCircleContentMedia(
  userId: string,
  file: File,
  kind: "image" | "video",
): Promise<string> {
  const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
  const path = `circles/${userId}/content-${kind}-${Date.now()}.${ext}`;
  try {
    const { error } = await sb.storage.from("media").upload(path, file, {
      contentType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
    });
    if (error) throw error;
    const { data } = sb.storage.from("media").getPublicUrl(path);
    return data.publicUrl as string;
  } catch {
    // Offline / storage unavailable — use object URL so the creator can still preview locally.
    return URL.createObjectURL(file);
  }
}
