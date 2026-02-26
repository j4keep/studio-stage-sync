import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ActiveBoost {
  id: string;
  content_type: string;
  content_id: string;
  budget: number;
  duration_days: number;
  end_date: string;
  impressions: number;
  clicks: number;
}

export const useActiveBoosts = (contentType?: string) => {
  const { data: boosts = [] } = useQuery<ActiveBoost[]>({
    queryKey: ["active-boosts", contentType],
    queryFn: async () => {
      let query = (supabase as any)
        .from("boosts")
        .select("id, content_type, content_id, budget, duration_days, end_date, impressions, clicks")
        .eq("status", "active")
        .gt("end_date", new Date().toISOString());
      if (contentType) query = query.eq("content_type", contentType);
      const { data } = await query.limit(20);
      return data || [];
    },
    staleTime: 60_000,
  });

  const boostedIds = new Set(boosts.map((b) => b.content_id));
  const isBoosted = (id: string) => boostedIds.has(id);

  return { boosts, boostedIds, isBoosted };
};
