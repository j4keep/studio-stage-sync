import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type CircleLiveSession = {
  id: string;
  circle_id: string;
  host_user_id: string;
  room: string;
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
};

/** The room name doubles as the LiveKit room id — must match the livekit-token edge
 *  function's `^[a-zA-Z0-9_-]+$` validation, which a raw circle uuid already satisfies. */
export async function startCircleLive(circleId: string, hostUserId: string): Promise<CircleLiveSession> {
  const room = `circle_${circleId}_${Date.now()}`;
  const { data, error } = await sb
    .from("circle_live_sessions")
    .insert({ circle_id: circleId, host_user_id: hostUserId, room, status: "live" })
    .select("*")
    .single();
  if (error) throw error;
  return data as CircleLiveSession;
}

export async function endCircleLive(sessionId: string): Promise<void> {
  const { error } = await sb
    .from("circle_live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
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
  return data as CircleLiveSession | null;
}
