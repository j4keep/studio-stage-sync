/**
 * My Circle exclusive content — stays inside the circle (never the main feed).
 * Prefers Supabase; falls back to localStorage when tables aren't applied yet.
 */

import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const LOCAL_KEY = "yaj.circle.contents.v1";
const LOCAL_RSVP_KEY = "yaj.circle.rsvps.v1";
const LOCAL_POLL_KEY = "yaj.circle.polls.v1";

export type CircleContentKind = "post" | "video";
export type CircleActivityType = "photo" | "event" | "community" | "update" | "exclusive" | "video";
export type CircleContentVisibility = "circle_members" | "paid_members" | "only_me" | "public_in_circle";
export type CommunitySubtype = "poll" | "question" | "challenge" | "activity";
export type EventRsvpStatus = "going" | "interested" | "cant_go";
/** Circle-level access — separate from per-post Exclusive visibility. */
export type CircleAccessMode = "public" | "private" | "paid";

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
  event_end_at: string | null;
  event_location: string | null;
  event_online_url: string | null;
  event_capacity: number | null;
  event_ticket_cents: number | null;
  event_reminders: boolean;
  community_subtype: CommunitySubtype | null;
  poll_options: string[];
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  liked_by_me?: boolean;
  my_rsvp?: EventRsvpStatus | null;
  my_poll_vote?: number | null;
  rsvp_counts?: Partial<Record<EventRsvpStatus, number>>;
  poll_counts?: number[];
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
  photo: { label: "Photo / Video", hint: "Normal Circle media post" },
  event: { label: "Event", hint: "Date, place, RSVP & calendar" },
  community: { label: "Community", hint: "Polls, questions & challenges" },
  update: { label: "Update", hint: "Fast announcement — pinable" },
  exclusive: { label: "Exclusive", hint: "Posted from the Exclusive tab" },
};

export const COMMUNITY_SUBTYPE_META: Record<CommunitySubtype, { label: string; hint: string }> = {
  poll: { label: "Poll", hint: "Let members vote" },
  question: { label: "Question", hint: "Ask the Circle" },
  challenge: { label: "Challenge", hint: "Call people to join in" },
  activity: { label: "Activity", hint: "Meetup or participation ask" },
};

export const EXCLUSIVE_VISIBILITY_OPTIONS: {
  id: CircleContentVisibility;
  label: string;
  hint: string;
}[] = [
  { id: "circle_members", label: "Members only", hint: "Anyone approved in this Circle" },
  { id: "paid_members", label: "Paid subscribers only", hint: "Requires Supporter Membership" },
];

export const CIRCLE_ACCESS_META: Record<
  CircleAccessMode,
  { label: string; hint: string }
> = {
  public: { label: "Public", hint: "Anybody can view and join" },
  private: { label: "Private", hint: "Owner approves members" },
  paid: { label: "Paid", hint: "Supporter Membership required to enter" },
};

export function deriveCircleAccessMode(circle: {
  is_private: boolean;
  is_paid: boolean;
  requires_approval: boolean;
}): CircleAccessMode {
  if (circle.is_paid) return "paid";
  if (circle.is_private) return "private";
  return "public";
}

export function accessModeToCirclePatch(mode: CircleAccessMode): {
  isPrivate: boolean;
  requiresApproval: boolean;
  isPaid: boolean;
} {
  if (mode === "paid") return { isPrivate: true, requiresApproval: true, isPaid: true };
  if (mode === "private") return { isPrivate: true, requiresApproval: true, isPaid: false };
  return { isPrivate: false, requiresApproval: false, isPaid: false };
}

type LocalStore = Record<string, CircleContent[]>;
type LocalLikes = Record<string, string[]>;
type LocalComments = Record<string, CircleContentComment[]>;
type LocalRsvps = Record<string, Record<string, EventRsvpStatus>>; // contentId -> userId -> status
type LocalPolls = Record<string, Record<string, number>>; // contentId -> userId -> optionIndex

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

function readLocalRsvps(): LocalRsvps {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_RSVP_KEY) || "{}") as LocalRsvps;
  } catch {
    return {};
  }
}

function writeLocalRsvps(v: LocalRsvps) {
  localStorage.setItem(LOCAL_RSVP_KEY, JSON.stringify(v));
}

function readLocalPolls(): LocalPolls {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_POLL_KEY) || "{}") as LocalPolls;
  } catch {
    return {};
  }
}

function writeLocalPolls(v: LocalPolls) {
  localStorage.setItem(LOCAL_POLL_KEY, JSON.stringify(v));
}

function isMissingTable(err: unknown): boolean {
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : String(err ?? "");
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    /circle_contents|circle_content_|does not exist|schema cache|Could not find|column .* does not exist/i.test(msg)
  );
}

function normalizeRow(raw: Partial<CircleContent> & { id: string }): CircleContent {
  return {
    id: raw.id,
    circle_id: raw.circle_id!,
    author_id: raw.author_id!,
    kind: raw.kind ?? "post",
    activity_type: raw.activity_type ?? "photo",
    title: raw.title ?? null,
    body: raw.body ?? null,
    media_urls: raw.media_urls ?? [],
    media_type: raw.media_type ?? "none",
    visibility: raw.visibility ?? "circle_members",
    donations_enabled: raw.donations_enabled !== false,
    like_count: raw.like_count ?? 0,
    view_count: raw.view_count ?? 0,
    comment_count: raw.comment_count ?? 0,
    event_at: raw.event_at ?? null,
    event_end_at: raw.event_end_at ?? null,
    event_location: raw.event_location ?? null,
    event_online_url: raw.event_online_url ?? null,
    event_capacity: raw.event_capacity ?? null,
    event_ticket_cents: raw.event_ticket_cents ?? null,
    event_reminders: Boolean(raw.event_reminders),
    community_subtype: raw.community_subtype ?? null,
    poll_options: raw.poll_options ?? [],
    tags: raw.tags ?? [],
    is_pinned: Boolean(raw.is_pinned),
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? new Date().toISOString(),
    liked_by_me: raw.liked_by_me,
    my_rsvp: raw.my_rsvp,
    my_poll_vote: raw.my_poll_vote,
    rsvp_counts: raw.rsvp_counts,
    poll_counts: raw.poll_counts,
  };
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
  tags?: string[];
  eventAt?: string | null;
  eventEndAt?: string | null;
  eventLocation?: string | null;
  eventOnlineUrl?: string | null;
  eventCapacity?: number | null;
  eventTicketCents?: number | null;
  eventReminders?: boolean;
  communitySubtype?: CommunitySubtype | null;
  pollOptions?: string[];
  isPinned?: boolean;
};

function toRow(input: CreateCircleContentInput): CircleContent {
  const now = new Date().toISOString();
  return normalizeRow({
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
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    event_at: input.eventAt ?? null,
    event_end_at: input.eventEndAt ?? null,
    event_location: input.eventLocation ?? null,
    event_online_url: input.eventOnlineUrl ?? null,
    event_capacity: input.eventCapacity ?? null,
    event_ticket_cents: input.eventTicketCents ?? null,
    event_reminders: Boolean(input.eventReminders),
    community_subtype: input.communitySubtype ?? null,
    poll_options: (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean),
    is_pinned: Boolean(input.isPinned),
    like_count: 0,
    view_count: 0,
    comment_count: 0,
    created_at: now,
    updated_at: now,
  });
}

function insertPayload(input: CreateCircleContentInput) {
  return {
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
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    event_at: input.eventAt ?? null,
    event_end_at: input.eventEndAt ?? null,
    event_location: input.eventLocation ?? null,
    event_online_url: input.eventOnlineUrl ?? null,
    event_capacity: input.eventCapacity ?? null,
    event_ticket_cents: input.eventTicketCents ?? null,
    event_reminders: Boolean(input.eventReminders),
    community_subtype: input.communitySubtype ?? null,
    poll_options: (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean),
    is_pinned: Boolean(input.isPinned),
  };
}

export async function createCircleContent(input: CreateCircleContentInput): Promise<CircleContent> {
  try {
    const { data, error } = await sb.from("circle_contents").insert(insertPayload(input)).select("*").single();
    if (error) throw error;
    return normalizeRow(data as CircleContent);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const local = toRow(input);
    const store = readLocal();
    store[input.circleId] = [local, ...(store[input.circleId] ?? [])];
    writeLocal(store);
    return local;
  }
}

function sortContents(rows: CircleContent[]): CircleContent[] {
  return rows.slice().sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

function attachLocalEngagement(rows: CircleContent[], userId?: string): CircleContent[] {
  const likes = readLocalLikes();
  const rsvps = readLocalRsvps();
  const polls = readLocalPolls();
  return rows.map((r) => {
    const rsvpMap = rsvps[r.id] ?? {};
    const pollMap = polls[r.id] ?? {};
    const rsvp_counts: Partial<Record<EventRsvpStatus, number>> = { going: 0, interested: 0, cant_go: 0 };
    Object.values(rsvpMap).forEach((s) => {
      rsvp_counts[s] = (rsvp_counts[s] ?? 0) + 1;
    });
    const poll_counts = (r.poll_options ?? []).map((_, i) =>
      Object.values(pollMap).filter((v) => v === i).length,
    );
    return {
      ...r,
      liked_by_me: userId ? (likes[r.id] ?? []).includes(userId) : false,
      my_rsvp: userId ? rsvpMap[userId] ?? null : null,
      my_poll_vote: userId && pollMap[userId] !== undefined ? pollMap[userId] : null,
      rsvp_counts,
      poll_counts,
    };
  });
}

export async function listCircleContents(
  circleId: string,
  opts: { kind?: CircleContentKind; userId?: string; exclusiveOnly?: boolean } = {},
): Promise<CircleContent[]> {
  try {
    let q = sb.from("circle_contents").select("*").eq("circle_id", circleId);
    if (opts.kind) q = q.eq("kind", opts.kind);
    if (opts.exclusiveOnly) q = q.eq("activity_type", "exclusive");
    const { data, error } = await q;
    if (error) throw error;
    let rows = sortContents(((data as CircleContent[]) || []).map(normalizeRow));
    if (!opts.exclusiveOnly) {
      rows = rows.filter((r) => r.activity_type !== "exclusive");
    }
    if (!opts.userId || !rows.length) return rows;

    const ids = rows.map((r) => r.id);
    let liked = new Set<string>();
    let rsvpRows: { content_id: string; user_id: string; status: EventRsvpStatus }[] = [];
    let voteRows: { content_id: string; user_id: string; option_index: number }[] = [];

    try {
      const [{ data: likes }, { data: rsvps }, { data: votes }] = await Promise.all([
        sb.from("circle_content_likes").select("content_id").eq("user_id", opts.userId).in("content_id", ids),
        sb.from("circle_content_rsvps").select("content_id, user_id, status").in("content_id", ids),
        sb.from("circle_content_poll_votes").select("content_id, user_id, option_index").in("content_id", ids),
      ]);
      liked = new Set(((likes as { content_id: string }[]) || []).map((l) => l.content_id));
      rsvpRows = (rsvps as { content_id: string; user_id: string; status: EventRsvpStatus }[]) || [];
      voteRows = (votes as { content_id: string; user_id: string; option_index: number }[]) || [];
    } catch {
      try {
        const { data: likes } = await sb
          .from("circle_content_likes")
          .select("content_id")
          .eq("user_id", opts.userId)
          .in("content_id", ids);
        liked = new Set(((likes as { content_id: string }[]) || []).map((l) => l.content_id));
      } catch {
        /* ignore */
      }
    }

    return rows.map((r) => {
      const mine = rsvpRows.find((x) => x.content_id === r.id && x.user_id === opts.userId);
      const rsvp_counts: Partial<Record<EventRsvpStatus, number>> = { going: 0, interested: 0, cant_go: 0 };
      rsvpRows.filter((x) => x.content_id === r.id).forEach((x) => {
        rsvp_counts[x.status] = (rsvp_counts[x.status] ?? 0) + 1;
      });
      const poll_counts = (r.poll_options ?? []).map((_, i) =>
        voteRows.filter((v) => v.content_id === r.id && v.option_index === i).length,
      );
      const myVote = voteRows.find((v) => v.content_id === r.id && v.user_id === opts.userId);
      return {
        ...r,
        liked_by_me: liked.has(r.id),
        my_rsvp: mine?.status ?? null,
        my_poll_vote: myVote ? myVote.option_index : null,
        rsvp_counts,
        poll_counts,
      };
    });
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const store = readLocal();
    let rows = store[circleId] ?? [];
    if (opts.kind) rows = rows.filter((r) => r.kind === opts.kind);
    if (opts.exclusiveOnly) rows = rows.filter((r) => r.activity_type === "exclusive");
    else rows = rows.filter((r) => r.activity_type !== "exclusive");
    return attachLocalEngagement(sortContents(rows.map(normalizeRow)), opts.userId);
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
    store[circleId] = (store[circleId] ?? []).map((c) =>
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
    store[circleId] = (store[circleId] ?? []).map((c) => (c.id === contentId ? { ...c, view_count: c.view_count + 1 } : c));
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
      await sb.from("circle_contents").update({ comment_count: (row.comment_count ?? 0) + 1 }).eq("id", contentId);
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

export async function setCircleContentRsvp(
  contentId: string,
  userId: string,
  status: EventRsvpStatus,
): Promise<void> {
  try {
    const { error } = await sb.from("circle_content_rsvps").upsert(
      { content_id: contentId, user_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: "content_id,user_id" },
    );
    if (error) throw error;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const all = readLocalRsvps();
    all[contentId] = { ...(all[contentId] ?? {}), [userId]: status };
    writeLocalRsvps(all);
  }
}

export async function setCirclePollVote(contentId: string, userId: string, optionIndex: number): Promise<void> {
  try {
    const { error } = await sb.from("circle_content_poll_votes").upsert(
      { content_id: contentId, user_id: userId, option_index: optionIndex },
      { onConflict: "content_id,user_id" },
    );
    if (error) throw error;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const all = readLocalPolls();
    all[contentId] = { ...(all[contentId] ?? {}), [userId]: optionIndex };
    writeLocalPolls(all);
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
    return URL.createObjectURL(file);
  }
}

/** Build a Google Calendar-style URL for an event post. */
export function buildEventCalendarUrl(item: CircleContent): string | null {
  if (!item.event_at) return null;
  const start = new Date(item.event_at);
  const end = item.event_end_at ? new Date(item.event_end_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title || "Circle event",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: item.body || "",
    location: item.event_location || item.event_online_url || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
