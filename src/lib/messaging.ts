import { supabase } from "@/integrations/supabase/client";

export type ConversationContext = "marketplace" | "local_help" | "circle" | "dating" | null;

/**
 * Finds an existing 1:1 conversation between two users, or creates one.
 * Safe to call from any page.
 * When `context` is provided, stamps / upgrades the conversation so reopen
 * from the inbox still routes profile taps correctly (e.g. Marketplace vs artist).
 */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string,
  opts?: { context?: ConversationContext },
): Promise<string> {
  const context = opts?.context ?? null;

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
    if (shared && shared.length > 0) {
      const id = shared[0].conversation_id;
      if (context) {
        await (supabase as any)
          .from("conversations")
          .update({ context })
          .eq("id", id)
          .is("context", null);
        // Always reinforce marketplace context when messaging from Marketplace
        if (context === "marketplace") {
          await (supabase as any).from("conversations").update({ context }).eq("id", id);
        }
      }
      return id;
    }
  }

  const insertRow: Record<string, unknown> = { created_by: userId };
  if (context) insertRow.context = context;

  const { data: conv, error: convErr } = await (supabase as any)
    .from("conversations")
    .insert(insertRow)
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

  return conv.id as string;
}
