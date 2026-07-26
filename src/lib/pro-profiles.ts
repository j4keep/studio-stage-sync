import { supabase } from "@/integrations/supabase/client";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import { PROJECT_TYPES, WORK_FOCUS, defaultServiceMap } from "@/lib/hire-pro";

export type ProMedia = { url: string; label?: string; category?: string };

export type ProProfile = {
  user_id: string;
  business_name: string | null;
  about: string | null;
  hourly_rate: number | null;
  service_area: string | null;
  categories: string[];
  project_types: Record<string, boolean>;
  work_focus: Record<string, boolean>;
  media: ProMedia[];
  skills: string[];
  responds_minutes: number | null;
  is_active: boolean;
  hired_count: number;
  similar_jobs_count: number;
  display_name: string | null;
  avatar_url: string | null;
  gig_experience_bio: string | null;
  rating: DisplayRating;
};

function normalizeMap(raw: unknown, fallback: Record<string, boolean>): Record<string, boolean> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...fallback, ...(raw as Record<string, boolean>) };
  }
  return { ...fallback };
}

function mapRow(row: any, profile: any, rating: DisplayRating): ProProfile {
  return {
    user_id: row.user_id,
    business_name: row.business_name,
    about: row.about,
    hourly_rate: row.hourly_rate != null ? Number(row.hourly_rate) : null,
    service_area: row.service_area,
    categories: row.categories || [],
    project_types: normalizeMap(row.project_types, defaultServiceMap(PROJECT_TYPES, true)),
    work_focus: normalizeMap(row.work_focus, defaultServiceMap(WORK_FOCUS, true)),
    media: Array.isArray(row.media) ? row.media : [],
    skills: row.skills || [],
    responds_minutes: row.responds_minutes,
    is_active: Boolean(row.is_active),
    hired_count: row.hired_count || 0,
    similar_jobs_count: row.similar_jobs_count || 0,
    display_name: profile?.display_name || row.business_name || "Pro",
    avatar_url: profile?.avatar_url || null,
    gig_experience_bio: profile?.gig_experience_bio || null,
    rating,
  };
}

export async function listProsByCategory(categoryId: string): Promise<ProProfile[]> {
  const { data, error } = await (supabase as any)
    .from("pro_profiles")
    .select("*")
    .eq("is_active", true)
    .contains("categories", [categoryId])
    .order("hired_count", { ascending: false })
    .limit(40);
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  const ids = rows.map((r: any) => r.user_id);
  const [{ data: profiles }, ratings] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, avatar_url, gig_experience_bio").in("user_id", ids),
    fetchRatingsByUserIds(ids),
  ]);
  const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return rows.map((r: any) => mapRow(r, map.get(r.user_id), ratings[r.user_id]));
}

export async function getProProfile(userId: string): Promise<ProProfile | null> {
  const { data, error } = await (supabase as any)
    .from("pro_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [{ data: profile }, ratings] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, gig_experience_bio")
      .eq("user_id", userId)
      .maybeSingle(),
    fetchRatingsByUserIds([userId]),
  ]);
  return mapRow(data, profile, ratings[userId]);
}

export async function upsertProProfile(userId: string, patch: Partial<ProProfile>) {
  const payload = {
    user_id: userId,
    business_name: patch.business_name ?? null,
    about: patch.about ?? null,
    hourly_rate: patch.hourly_rate ?? null,
    service_area: patch.service_area ?? null,
    categories: patch.categories ?? ["handyman"],
    project_types: patch.project_types ?? defaultServiceMap(PROJECT_TYPES, true),
    work_focus: patch.work_focus ?? defaultServiceMap(WORK_FOCUS, true),
    media: patch.media ?? [],
    skills: patch.skills ?? [],
    responds_minutes: patch.responds_minutes ?? 60,
    is_active: patch.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any).from("pro_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

export async function listProReviews(userId: string, limit = 20) {
  const { data } = await supabase
    .from("user_ratings")
    .select("id, score, comment, created_at, rater_id, context_type, context_id")
    .eq("ratee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data || [];
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.rater_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids);
  const map = new Map((profiles || []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({
    ...r,
    display_name: map.get(r.rater_id)?.display_name || "Neighbor",
    avatar_url: map.get(r.rater_id)?.avatar_url || null,
  }));
}
