import { supabase } from "@/integrations/supabase/client";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import { PROJECT_TYPES, WORK_FOCUS, defaultServiceMap } from "@/lib/local-help";

export type ProMedia = { url: string; label?: string; category?: string };

export type LocalHelpPro = {
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
  /** Local Help marketplace rating only — not shown on YAJ artist profile */
  rating: DisplayRating;
};

function normalizeMap(raw: unknown, fallback: Record<string, boolean>): Record<string, boolean> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...fallback, ...(raw as Record<string, boolean>) };
  }
  return { ...fallback };
}

function mapRow(row: any, profile: any, rating: DisplayRating): LocalHelpPro {
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
    display_name: profile?.display_name || row.business_name || "Helper",
    avatar_url: profile?.avatar_url || null,
    gig_experience_bio: profile?.gig_experience_bio || null,
    rating,
  };
}

export async function listLocalHelpPros(categoryId?: string, search?: string): Promise<LocalHelpPro[]> {
  let q = (supabase as any).from("pro_profiles").select("*").eq("is_active", true).limit(50);
  if (categoryId) q = q.contains("categories", [categoryId]);
  const { data, error } = await q.order("hired_count", { ascending: false });
  if (error) throw error;
  let rows = data || [];
  if (search?.trim()) {
    const n = search.trim().toLowerCase();
    rows = rows.filter(
      (r: any) =>
        (r.business_name || "").toLowerCase().includes(n) ||
        (r.about || "").toLowerCase().includes(n) ||
        (r.skills || []).some((s: string) => s.toLowerCase().includes(n)) ||
        (r.categories || []).some((c: string) => c.toLowerCase().includes(n)),
    );
  }
  if (!rows.length) return [];

  const ids = rows.map((r: any) => r.user_id);
  const [{ data: profiles }, ratings] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, avatar_url, gig_experience_bio").in("user_id", ids),
    fetchRatingsByUserIds(ids),
  ]);
  const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return rows.map((r: any) => mapRow(r, map.get(r.user_id), ratings[r.user_id]));
}

export async function getLocalHelpPro(userId: string): Promise<LocalHelpPro | null> {
  const { data, error } = await (supabase as any).from("pro_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [{ data: profile }, ratings] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, avatar_url, gig_experience_bio").eq("user_id", userId).maybeSingle(),
    fetchRatingsByUserIds([userId]),
  ]);
  return mapRow(data, profile, ratings[userId]);
}

export type LocalHelpProUpsert = {
  business_name?: string | null;
  about?: string | null;
  hourly_rate?: number | null;
  service_area?: string | null;
  categories?: string[];
  project_types?: Record<string, boolean>;
  work_focus?: Record<string, boolean>;
  media?: ProMedia[];
  skills?: string[];
  responds_minutes?: number | null;
  is_active?: boolean;
};

export async function upsertLocalHelpPro(userId: string, patch: LocalHelpProUpsert) {
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
    responds_minutes: patch.responds_minutes ?? 45,
    is_active: patch.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any).from("pro_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

export async function listLocalHelpReviews(userId: string, limit = 30) {
  const { data } = await supabase
    .from("user_ratings")
    .select("id, score, comment, created_at, rater_id, context_type")
    .eq("ratee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data || [];
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.rater_id))];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
  const map = new Map((profiles || []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({
    ...r,
    display_name: map.get(r.rater_id)?.display_name || "Neighbor",
    avatar_url: map.get(r.rater_id)?.avatar_url || null,
  }));
}

/** Create a gig need and open chat with a helper — discovery in Explore, engine in Jobs/gigs. */
export async function hireLocalHelper(opts: {
  customerId: string;
  helperId: string;
  title: string;
  description: string;
  category: string;
  budgetMin?: number;
  budgetMax?: number;
}) {
  const { data: gig, error } = await (supabase as any)
    .from("gig_listings")
    .insert({
      poster_id: opts.customerId,
      title: opts.title,
      description: opts.description,
      category: opts.category,
      status: "open",
      urgency: "flexible",
      budget_min: opts.budgetMin ?? null,
      budget_max: opts.budgetMax ?? null,
    })
    .select("id, title")
    .single();
  if (error) throw error;

  // Record preferred helper as interested so host can approve from gig detail
  try {
    await (supabase as any).from("gig_interests").upsert(
      {
        gig_id: gig.id,
        user_id: opts.helperId,
        experience_bio: "Invited via Find Local Help",
        status: "interested",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gig_id,user_id" },
    );
  } catch {
    /* interests table may be missing — chat still works */
  }

  return gig as { id: string; title: string };
}
