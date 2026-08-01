import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

type CrowdComment = {
  id: string;
  content: string;
  name: string;
};

/** Compact live crowd strip under the battle meter (uses existing battle_comments). */
export default function BattleCrowdReaction({
  battleId,
  enabled = true,
}: {
  battleId: string;
  enabled?: boolean;
}) {
  const [items, setItems] = useState<CrowdComment[]>([]);

  useEffect(() => {
    if (!battleId || !enabled) return;

    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("battle_comments")
        .select("id, content, user_id, created_at")
        .eq("battle_id", battleId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled || !data?.length) return;
      const ids = [...new Set(data.map((c: any) => String(c.user_id)))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]));
      setItems(
        data
          .filter((c: any) => (c.content || "").trim().length > 1)
          .slice(0, 5)
          .map((c: any) => ({
            id: c.id,
            content: c.content,
            name: map.get(c.user_id) || "Fan",
          })),
      );
    };

    void load();

    const channel = supabase
      .channel(`crowd-reaction-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_comments",
          filter: `battle_id=eq.${battleId}`,
        },
        async (payload: any) => {
          const row = payload.new;
          if (!row?.content || String(row.content).trim().length <= 1) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.user_id)
            .maybeSingle();
          setItems((prev) =>
            [
              {
                id: row.id,
                content: row.content,
                name: profile?.display_name || "Fan",
              },
              ...prev,
            ].slice(0, 5),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [battleId, enabled]);

  if (!enabled) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 px-3.5 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400">
          🔥 Crowd Reaction
        </p>
        <p className="text-[10px] text-muted-foreground">Live comments</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Be the first to react — drop a comment while the battle is live.
        </p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map((c) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-muted/40 px-2.5 py-1.5 text-xs leading-snug text-foreground"
              >
                <span className="font-bold text-muted-foreground">{c.name}: </span>
                {c.content}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
