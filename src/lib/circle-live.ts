import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type CircleLiveLayoutMode = "live" | "multi" | "virtual";

export type CircleLiveSession = {
  id: string;
  /** null = a public live tied directly to host_user_id (shows on the feed, anyone can
   *  watch) rather than gated to a Circle's approved members. Same table, same room page
   *  either way — deliberately one shared structure, not two. */
  circle_id: string | null;
  host_user_id: string;
  room: string;
  status: "live" | "ended";
  /** Prep picker: Live (solo host) | Multi (motor / guest grid) | Virtual. */
  layout_mode?: CircleLiveLayoutMode;
  started_at: string;
  ended_at: string | null;
};

export async function endCircleLive(sessionId: string): Promise<void> {
  const { error } = await sb
    .from("circle_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

/** End every still-`live` session for a host (optionally scoped to one Circle or public). */
export async function endActiveLivesForHost(
  hostUserId: string,
  opts?: { circleId?: string | null; exceptSessionId?: string | null },
): Promise<number> {
  let q = sb
    .from("circle_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("host_user_id", hostUserId)
    .eq("status", "live");

  if (opts && "circleId" in (opts || {})) {
    if (opts?.circleId == null) q = q.is("circle_id", null);
    else q = q.eq("circle_id", opts.circleId);
  }
  if (opts?.exceptSessionId) q = q.neq("id", opts.exceptSessionId);

  const { data, error } = await q.select("id");
  if (error) {
    console.warn("[circle-live] endActiveLivesForHost", error.message);
    return 0;
  }
  return (data || []).length;
}

export async function endCircleLivesByIds(sessionIds: string[]): Promise<void> {
  const ids = sessionIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await sb
    .from("circle_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .in("id", ids);
  if (error) console.warn("[circle-live] endCircleLivesByIds", error.message);
}

/** The room name doubles as the LiveKit room id — must match the livekit-token edge
 *  function's `^[a-zA-Z0-9_-]+$` validation, which a raw circle/user uuid already
 *  satisfies. Pass circleId: null for a public live (posted to the feed, open to anyone)
 *  instead of a Circle-gated one. */
export async function startCircleLive(
  circleId: string | null,
  hostUserId: string,
  layoutMode: CircleLiveLayoutMode = "live",
): Promise<CircleLiveSession> {
  // One live at a time per host — kill ghost sessions left behind by a closed tab / white screen.
  await endActiveLivesForHost(hostUserId);

  const room = `${circleId ? "circle" : "user"}_${circleId ?? hostUserId}_${Date.now()}`;
  const mode: CircleLiveLayoutMode =
    layoutMode === "multi" || layoutMode === "virtual" ? layoutMode : "live";
  const base = {
    circle_id: circleId,
    host_user_id: hostUserId,
    room,
    status: "live" as const,
  };

  // Prefer writing layout_mode; if the column isn't migrated yet, fall back so Go Live
  // still works and Multi is recovered from sessionStorage prep looks.
  let { data, error } = await sb
    .from("circle_live_sessions")
    .insert({ ...base, layout_mode: mode })
    .select("*")
    .single();

  if (error && /layout_mode/i.test(error.message || "")) {
    ({ data, error } = await sb.from("circle_live_sessions").insert(base).select("*").single());
    if (!error && data) {
      return { ...(data as CircleLiveSession), layout_mode: mode };
    }
  }
  if (error) throw error;
  return data as CircleLiveSession;
}

export async function getActiveLiveSession(circleId: string): Promise<CircleLiveSession | null> {
  const { data, error } = await sb
    .from("circle_live_sessions")
    .select("*")
    .eq("circle_id", circleId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CircleLiveSession | null;
}

export async function getLiveSession(sessionId: string): Promise<CircleLiveSession | null> {
  const { data, error } = await sb.from("circle_live_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  const row = data as CircleLiveSession | null;
  if (!row) return null;
  // Treat ended rows as missing so the room page shows "ended" instead of a white/broken room.
  if (row.status !== "live") return null;
  return row;
}

/** The active public (circle_id null) live for a given host, if any — mirrors
 *  getActiveLiveSession but for a person's feed-facing live instead of a Circle's. */
export async function getActivePublicLiveSession(hostUserId: string): Promise<CircleLiveSession | null> {
  const { data, error } = await sb
    .from("circle_live_sessions")
    .select("*")
    .eq("host_user_id", hostUserId)
    .is("circle_id", null)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CircleLiveSession | null;
}

export type PublicLiveWithHost = CircleLiveSession & {
  host_display_name: string | null;
  host_avatar_url: string | null;
};

/** Everyone currently live on the feed (circle_id null) — powers the Home "Live Now"
 *  row. Two-step fetch (session rows, then a batch profile lookup) rather than a
 *  relational select — host_user_id isn't declared as an FK to profiles. */
export async function listActivePublicLiveSessions(limit = 20): Promise<PublicLiveWithHost[]> {
  const { data: sessions, error } = await sb
    .from("circle_live_sessions")
    .select("*")
    .is("circle_id", null)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(Math.max(limit * 3, 20));
  if (error) throw error;
  const rows = (sessions as CircleLiveSession[]) || [];
  if (!rows.length) return [];

  // One card / pitch bubble per host — heal older duplicate "still live" ghosts.
  const seen = new Set<string>();
  const unique: CircleLiveSession[] = [];
  const duplicateIds: string[] = [];
  for (const row of rows) {
    if (seen.has(row.host_user_id)) {
      duplicateIds.push(row.id);
      continue;
    }
    seen.add(row.host_user_id);
    if (unique.length < limit) unique.push(row);
    // Else: another host past the display limit — leave them live, just don't show.
  }
  if (duplicateIds.length) void endCircleLivesByIds(duplicateIds);

  const ids = Array.from(new Set(unique.map((r) => r.host_user_id)));
  const { data: profiles } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
  const byId = new Map<string, { display_name: string | null; avatar_url: string | null }>(
    (profiles || []).map((p: any) => [p.user_id, p]),
  );
  return unique.map((r) => ({
    ...r,
    host_display_name: byId.get(r.host_user_id)?.display_name ?? null,
    host_avatar_url: byId.get(r.host_user_id)?.avatar_url ?? null,
  }));
}

export type GiftType = "like" | "heart" | "rose" | "star" | "fire" | "party" | "money" | "rocket" | "diamond" | "unicorn" | "crown";

/** Display-only "value" — no real money moves yet. Card capture + actual charges are
 *  explicit future work; this is purely the sending/animation layer for now. `like` is
 *  the free, unlimited quick-tap reaction; everything else is the gift-sheet catalog. */
export const GIFT_CATALOG: { type: GiftType; emoji: string; label: string; value: string }[] = [
  { type: "heart", emoji: "❤️", label: "Heart", value: "$1" },
  { type: "star", emoji: "⭐", label: "Star", value: "$2" },
  { type: "rose", emoji: "🌹", label: "Rose", value: "$5" },
  { type: "party", emoji: "🎉", label: "Party", value: "$8" },
  { type: "fire", emoji: "🔥", label: "Fire", value: "$10" },
  { type: "rocket", emoji: "🚀", label: "Rocket", value: "$15" },
  { type: "diamond", emoji: "💎", label: "Diamond", value: "$25" },
  { type: "unicorn", emoji: "🦄", label: "Unicorn", value: "$40" },
  { type: "money", emoji: "💰", label: "Money Bag", value: "$75" },
  { type: "crown", emoji: "👑", label: "Crown", value: "$100" },
];

export const LIKE_GIFT: { type: GiftType; emoji: string; label: string; value: string } = {
  type: "like",
  emoji: "❤️",
  label: "Like",
  value: "Free",
};

export type CircleLiveGift = {
  id: string;
  session_id: string;
  circle_id: string | null;
  sender_id: string;
  gift_type: GiftType;
  created_at: string;
};

export async function sendCircleLiveGift(sessionId: string, circleId: string | null, senderId: string, giftType: GiftType): Promise<CircleLiveGift> {
  const { data, error } = await sb
    .from("circle_live_gifts")
    .insert({ session_id: sessionId, circle_id: circleId, sender_id: senderId, gift_type: giftType })
    .select("*")
    .single();
  if (error) throw error;
  return data as CircleLiveGift;
}

export type CircleLiveComment = {
  id: string;
  session_id: string;
  circle_id: string | null;
  sender_id: string;
  text: string;
  created_at: string;
};

export async function sendCircleLiveComment(sessionId: string, circleId: string | null, senderId: string, text: string): Promise<CircleLiveComment> {
  const { data, error } = await sb
    .from("circle_live_comments")
    .insert({ session_id: sessionId, circle_id: circleId, sender_id: senderId, text: text.trim().slice(0, 200) })
    .select("*")
    .single();
  if (error) throw error;
  return data as CircleLiveComment;
}

export async function listCircleLiveComments(sessionId: string, limit = 50): Promise<CircleLiveComment[]> {
  const { data, error } = await sb
    .from("circle_live_comments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as CircleLiveComment[]) || []).reverse();
}
