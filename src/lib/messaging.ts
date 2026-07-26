import { supabase } from "@/integrations/supabase/client";

/**
 * Finds an existing 1:1 conversation between two users, or creates one.
 * Safe to call from any page.
 */
export async function getOrCreateConversation(userId: string, otherUserId: string): Promise<string> {
  // My conversations
  const { data: mine, error: mineErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  if (mineErr) throw new Error(mineErr.message);

  const myIds = (mine || []).map((p) => p.conversation_id);
  if (myIds.length > 0) {
    const { data: shared } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myIds);
    if (shared && shared.length > 0) return shared[0].conversation_id;
  }

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ created_by: userId })
    .select("id")
    .single();
  if (convErr || !conv) throw new Error(convErr?.message || "Could not start chat");

  // Insert my row FIRST so membership exists before adding the other person
  const { error: selfErr } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conv.id, user_id: userId });
  if (selfErr) throw new Error(selfErr.message);

  const { error: otherErr } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conv.id, user_id: otherUserId });
  if (otherErr) throw new Error(otherErr.message);

  return conv.id;
}
