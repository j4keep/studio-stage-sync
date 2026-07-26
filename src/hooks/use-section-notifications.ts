import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Profile sections that can show an unread red dot. */
export type NotifSection = "gigs" | "bookings" | "localHelp" | "purchases" | "support";

const sectionOf = (n: any): NotifSection | null => {
  const t = String(n?.type || "");
  const r = String(n?.reference_type || "");
  if (t === "gig" || r === "gig") return "gigs";
  if (t === "rating" || r === "rating") return "localHelp";
  if (t === "booking" || r === "booking") return "bookings";
  if (t === "purchase" || r === "purchase") return "purchases";
  if (t === "ticket" || r === "ticket") return "support";
  return null;
};

const empty: Record<NotifSection, number> = {
  gigs: 0,
  bookings: 0,
  localHelp: 0,
  purchases: 0,
  support: 0,
};

/**
 * Unread notification counts bucketed per profile section, so each menu row can
 * show a red dot until the user actually opens that area.
 */
export function useSectionNotifications() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<NotifSection, number>>(empty);

  const refresh = useCallback(async () => {
    if (!user) return setCounts(empty);
    const { data } = await (supabase as any)
      .from("notifications")
      .select("id, type, reference_type, is_read, read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const next = { ...empty };
    (data || []).forEach((n: any) => {
      if (n.is_read || n.read) return;
      const s = sectionOf(n);
      if (s) next[s] += 1;
    });
    setCounts(next);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`section-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  /** Mark every unread notification for a section as read (dot disappears). */
  const clearSection = useCallback(
    async (section: NotifSection) => {
      if (!user || !counts[section]) return;
      setCounts((c) => ({ ...c, [section]: 0 }));
      const { data } = await (supabase as any)
        .from("notifications")
        .select("id, type, reference_type, is_read, read")
        .eq("user_id", user.id)
        .limit(200);
      const ids = (data || [])
        .filter((n: any) => !(n.is_read || n.read) && sectionOf(n) === section)
        .map((n: any) => n.id);
      if (!ids.length) return;
      await (supabase as any).from("notifications").update({ is_read: true, read: true }).in("id", ids);
      void refresh();
    },
    [user?.id, counts, refresh],
  );

  return { counts, clearSection, refresh };
}
