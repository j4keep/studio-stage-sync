import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FleetClashLiveSample = {
  x: number;
  z: number;
  rivalX: number;
  rivalZ: number;
  health: number;
  rivalHealth: number;
  crew: number;
  rivalCrew: number;
  progress: number;
  rivalProgress: number;
};

const channelName = (gameId: string) => `fleetclash-live:${gameId}`;

/** Player side: broadcasts the race's live position a few times a second so a spectator's
 *  feed post can mirror it, the same way YAJ Obby broadcasts racer ghosts. Fleet Clash never
 *  writes its live position to game_state (only the final result), so this is the only path
 *  a spectator has to see the boat actually moving. */
export function useFleetClashBroadcast(gameId: string | undefined) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase.channel(channelName(gameId), { config: { broadcast: { self: false } } });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId]);

  return useCallback((sample: FleetClashLiveSample) => {
    void channelRef.current?.send({ type: "broadcast", event: "pos", payload: sample });
  }, []);
}

/** Spectator side: the latest broadcast sample for a live Fleet Clash race, or null until
 *  the player's client sends its first one. */
export function useFleetClashSpectate(gameId: string): FleetClashLiveSample | null {
  const [sample, setSample] = useState<FleetClashLiveSample | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(channelName(gameId), { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => setSample(payload as FleetClashLiveSample))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return sample;
}
