import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ghost } from "@/components/games/obby/ObbyStage";

type Opts = {
  gameId: string | undefined;
  userId: string | undefined;
  name: string;
  color: string;
  enabled: boolean;
};

/**
 * Realtime racing: every phone broadcasts its racer's position several times a
 * second so you actually see your opponent running the course beside you.
 */
export function useObbyLive({ gameId, userId, name, color, enabled }: Opts) {
  const channelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, Ghost & { at: number }>>(new Map());
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [oppFinishMs, setOppFinishMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !gameId || !userId) return;
    const channel = supabase.channel(`obby:${gameId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id || payload.id === userId) return;
        peersRef.current.set(payload.id, {
          id: payload.id,
          name: payload.name || "Racer",
          color: payload.color || "#ff8a3d",
          x: payload.x,
          y: payload.y,
          z: payload.z,
          ry: payload.ry ?? 0,
          at: Date.now(),
        });
      })
      .on("broadcast", { event: "fin" }, ({ payload }: any) => {
        if (payload?.id && payload.id !== userId) setOppFinishMs(payload.ms ?? 0);
      })
      .subscribe();

    const tick = window.setInterval(() => {
      const now = Date.now();
      const live: Ghost[] = [];
      peersRef.current.forEach((p, id) => {
        if (now - p.at > 8000) peersRef.current.delete(id);
        else live.push({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, ry: p.ry });
      });
      setGhosts(live);
    }, 100);

    return () => {
      window.clearInterval(tick);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      peersRef.current.clear();
      setGhosts([]);
    };
  }, [enabled, gameId, userId]);

  const sample = useCallback(
    (x: number, y: number, z: number, ry: number) => {
      const ch = channelRef.current;
      if (!ch || !userId) return;
      void ch.send({ type: "broadcast", event: "pos", payload: { id: userId, name, color, x, y, z, ry } });
    },
    [userId, name, color],
  );

  const announceFinish = useCallback(
    (ms: number) => {
      const ch = channelRef.current;
      if (!ch || !userId) return;
      void ch.send({ type: "broadcast", event: "fin", payload: { id: userId, ms } });
    },
    [userId],
  );

  return { ghosts, sample, announceFinish, oppFinishMs };
}
