import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Unread inbound messages for the current user.
 * Prefers message notifications (same source as the bell for chat items);
 * falls back to unread rows in `messages` if notifications are empty/unavailable.
 */
export function useUnreadMessageCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data: notifs } = await (supabase as any)
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("reference_type", "message")
        .eq("is_read", false)
        .limit(50);
      const notifCount = (notifs || []).length;
      if (notifCount > 0) return notifCount;

      // Fallback: unread messages in my conversations (sender ≠ me)
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const convIds = (parts || []).map((p) => p.conversation_id);
      if (!convIds.length) return 0;

      const { data: unread, error } = await (supabase as any)
        .from("messages")
        .select("id")
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .eq("read", false)
        .limit(50);
      if (error) return 0;
      return (unread || []).length;
    },
    enabled: !!user,
    staleTime: 8_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return count;
}
