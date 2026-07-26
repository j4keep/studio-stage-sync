import { supabase } from "@/integrations/supabase/client";

/** Marketplace-style display score: start at 5.0, then use real average once rated. */
export type DisplayRating = {
  average: number;
  count: number;
  /** True when no real ratings yet — showing the starter 5.0 */
  isDefault: boolean;
};

export function resolveDisplayRating(average: number | null | undefined, count: number | null | undefined): DisplayRating {
  const n = count ?? 0;
  if (n > 0 && average != null && Number.isFinite(average)) {
    return {
      average: Math.round(average * 10) / 10,
      count: n,
      isDefault: false,
    };
  }
  return { average: 5, count: 0, isDefault: true };
}

export async function fetchRatingsByUserIds(userIds: string[]): Promise<Record<string, DisplayRating>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out: Record<string, DisplayRating> = {};
  for (const id of unique) out[id] = resolveDisplayRating(null, 0);
  if (!unique.length) return out;

  const { data } = await supabase.from("user_ratings").select("ratee_id, score").in("ratee_id", unique);
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const row of data || []) {
    const cur = acc[row.ratee_id] || { sum: 0, count: 0 };
    cur.sum += row.score;
    cur.count += 1;
    acc[row.ratee_id] = cur;
  }
  for (const id of unique) {
    const v = acc[id];
    out[id] = v ? resolveDisplayRating(v.sum / v.count, v.count) : resolveDisplayRating(null, 0);
  }
  return out;
}

export async function fetchUserDisplayRating(userId: string): Promise<DisplayRating> {
  const map = await fetchRatingsByUserIds([userId]);
  return map[userId] || resolveDisplayRating(null, 0);
}
