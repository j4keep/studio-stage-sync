/**
 * Supabase persistence helpers for live sessions.
 * Keeps DB logic out of SessionContext for clarity.
 */
import { supabase } from "@/integrations/supabase/client";

/** Upsert a live_sessions row by session_code. Returns the row id. */
export async function upsertLiveSession(
  sessionCode: string,
  createdBy: string,
  bookingId?: string | null,
): Promise<string | null> {
  // Try to find existing session first
  const { data: existing } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("session_code", sessionCode)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new session
  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      session_code: sessionCode,
      created_by: createdBy,
      booking_id: bookingId ?? null,
      status: "waiting",
    })
    .select("id")
    .single();

  if (error) {
    // Race condition: another tab/user created it between our select and insert
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("session_code", sessionCode)
        .single();
      return retry?.id ?? null;
    }
    console.error("[sessionDb] upsertLiveSession error:", error.message);
    return null;
  }
  return data.id;
}

/** Upsert a participant row. Idempotent via partial unique index (live_session_id, user_id). */
export async function upsertParticipant(
  liveSessionId: string,
  userId: string,
  role: "engineer" | "artist",
  displayName?: string,
) {
  // Try to find existing participant row for this user in this session
  const { data: existing } = await supabase
    .from("live_session_participants")
    .select("id")
    .eq("live_session_id", liveSessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Re-joining: clear left_at, update role/display_name, mark live
    const { error } = await supabase
      .from("live_session_participants")
      .update({
        role,
        display_name: displayName ?? null,
        is_live: true,
        left_at: null,
        mic_muted: false,
      })
      .eq("id", existing.id);

    if (error) console.error("[sessionDb] update participant error:", error.message);
    return;
  }

  // New participant
  const { error } = await supabase
    .from("live_session_participants")
    .insert({
      live_session_id: liveSessionId,
      user_id: userId,
      role,
      display_name: displayName ?? null,
      is_live: true,
      mic_muted: false,
    });

  if (error) {
    // Race: duplicate key → already inserted from another tab
    if (error.code === "23505") return;
    console.error("[sessionDb] insert participant error:", error.message);
  }
}

/** Mark participant as disconnected (set left_at, is_live = false). */
export async function markParticipantLeft(liveSessionId: string, userId: string) {
  const { error } = await supabase
    .from("live_session_participants")
    .update({ is_live: false, left_at: new Date().toISOString() })
    .eq("live_session_id", liveSessionId)
    .eq("user_id", userId);

  if (error) console.error("[sessionDb] markParticipantLeft error:", error.message);
}

export async function updateParticipantMicMuted(liveSessionId: string, userId: string, micMuted: boolean) {
  const { error } = await supabase
    .from("live_session_participants")
    .update({ mic_muted: micMuted })
    .eq("live_session_id", liveSessionId)
    .eq("user_id", userId);

  if (error) console.error("[sessionDb] updateParticipantMicMuted error:", error.message);
}

/** Upgrade session status to 'active' once both sides are present. */
export async function activateLiveSession(liveSessionId: string) {
  const { error } = await supabase
    .from("live_sessions")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", liveSessionId)
    .eq("status", "waiting");

  if (error && error.code !== "PGRST116") {
    console.error("[sessionDb] activateLiveSession error:", error.message);
  }
}

/** Resolve a session_code to a booking_id from studio_bookings (optional link). */
export async function lookupBookingByCode(sessionCode: string): Promise<string | null> {
  const { data } = await supabase
    .from("studio_bookings")
    .select("id")
    .eq("session_code", sessionCode)
    .maybeSingle();
  return data?.id ?? null;
}
