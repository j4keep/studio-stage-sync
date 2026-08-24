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

export type GiftType = "heart" | "rose" | "fire" | "diamond" | "crown";

/** Display-only "value" — no real money moves yet. Card capture + actual charges are
 *  explicit future work; this is purely the sending/animation layer for now. */
export const GIFT_CATALOG: { type: GiftType; emoji: string; label: string; value: string }[] = [
  { type: "heart", emoji: "❤️", label: "Heart", value: "$1" },
  { type: "rose", emoji: "🌹", label: "Rose", value: "$5" },
  { type: "fire", emoji: "🔥", label: "Fire", value: "$10" },
  { type: "diamond", emoji: "💎", label: "Diamond", value: "$25" },
  { type: "crown", emoji: "👑", label: "Crown", value: "$50" },
];

export type CircleLiveGift = {
  id: string;
  session_id: string;
  circle_id: string;
  sender_id: string;
  gift_type: GiftType;
  created_at: string;
};

export async function sendCircleLiveGift(sessionId: string, circleId: string, senderId: string, giftType: GiftType): Promise<CircleLiveGift> {
  const { data, error } = await sb
    .from("circle_live_gifts")
    .insert({ session_id: sessionId, circle_id: circleId, sender_id: senderId, gift_type: giftType })
    .select("*")
    .single();
  if (error) throw error;
  return data as CircleLiveGift;
}
