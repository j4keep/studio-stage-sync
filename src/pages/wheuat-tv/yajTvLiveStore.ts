/**
 * YAJ.TV Live — creators broadcast themselves (LiveKit), viewers watch and
 * chat, same shape as My Circle's public live feature. Deliberately no
 * gifts/donations here: Live TV never gets a donate button (that only
 * lives on uploaded/original tv_posts content, via wheuatTvStore).
 */
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type YajTvLiveSession = {
  id: string;
  host_user_id: string;
  room: string;
  title: string | null;
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
};

export type YajTvLiveWithHost = YajTvLiveSession & {
  host_display_name: string | null;
  host_avatar_url: string | null;
};

export type YajTvLiveComment = {
  id: string;
  session_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

async function endActiveYajTvLivesForHost(hostUserId: string, exceptSessionId?: string | null): Promise<void> {
  let q = sb
    .from("yajtv_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("host_user_id", hostUserId)
    .eq("status", "live");
  if (exceptSessionId) q = q.neq("id", exceptSessionId);
  const { error } = await q;
  if (error) console.warn("[yajtv-live] endActiveYajTvLivesForHost", error.message);
}

/** Room name doubles as the LiveKit room id — must match the livekit-token
 *  edge function's `^[a-zA-Z0-9_-]+$` validation. */
export async function startYajTvLive(hostUserId: string, title?: string | null): Promise<YajTvLiveSession> {
  // One live at a time per host — kill ghost sessions left behind by a closed tab.
  await endActiveYajTvLivesForHost(hostUserId);
  const room = `yajtv_${hostUserId.replace(/-/g, "")}_${Date.now()}`;
  const { data, error } = await sb
    .from("yajtv_live_sessions")
    .insert({ host_user_id: hostUserId, room, title: title?.trim() || null, status: "live" })
    .select("*")
    .single();
  if (error) throw error;
  return data as YajTvLiveSession;
}

export async function endYajTvLive(sessionId: string): Promise<void> {
  const { error } = await sb
    .from("yajtv_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function getYajTvLiveSession(sessionId: string): Promise<YajTvLiveSession | null> {
  const { data, error } = await sb.from("yajtv_live_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  const row = data as YajTvLiveSession | null;
  if (!row || row.status !== "live") return null;
  return row;
}

/** This host's current live session, if any — lets Creator Studio's "Go Live"
 *  button resume an in-progress broadcast instead of starting a duplicate. */
export async function getActiveYajTvLiveForHost(hostUserId: string): Promise<YajTvLiveSession | null> {
  const { data, error } = await sb
    .from("yajtv_live_sessions")
    .select("*")
    .eq("host_user_id", hostUserId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as YajTvLiveSession | null;
}

/** Everyone currently live — powers the Home "Live Now" row. */
export async function listActiveYajTvLiveSessions(limit = 20): Promise<YajTvLiveWithHost[]> {
  const { data: sessions, error } = await sb
    .from("yajtv_live_sessions")
    .select("*")
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (sessions as YajTvLiveSession[]) || [];
  if (!rows.length) return [];

  const ids = Array.from(new Set(rows.map((r) => r.host_user_id)));
  const { data: profiles } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
  const byId = new Map<string, { display_name: string | null; avatar_url: string | null }>(
    (profiles || []).map((p: any) => [p.user_id, p]),
  );
  return rows.map((r) => ({
    ...r,
    host_display_name: byId.get(r.host_user_id)?.display_name ?? null,
    host_avatar_url: byId.get(r.host_user_id)?.avatar_url ?? null,
  }));
}

export async function sendYajTvLiveComment(sessionId: string, senderId: string, text: string): Promise<YajTvLiveComment> {
  const { data, error } = await sb
    .from("yajtv_live_comments")
    .insert({ session_id: sessionId, sender_id: senderId, text: text.trim().slice(0, 200) })
    .select("*")
    .single();
  if (error) throw error;
  return data as YajTvLiveComment;
}

export async function listYajTvLiveComments(sessionId: string, limit = 50): Promise<YajTvLiveComment[]> {
  const { data, error } = await sb
    .from("yajtv_live_comments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as YajTvLiveComment[]) || []).reverse();
}
