import { supabase } from "@/integrations/supabase/client";

export type GigInterest = {
  id: string;
  gig_id: string;
  user_id: string;
  experience_bio: string | null;
  status: string;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export async function expressGigInterest(opts: {
  gigId: string;
  userId: string;
  experienceBio: string;
}) {
  const bio = opts.experienceBio.trim();
  await (supabase as any)
    .from("profiles")
    .update({ gig_experience_bio: bio || null })
    .eq("user_id", opts.userId);

  const { data, error } = await (supabase as any)
    .from("gig_interests")
    .upsert(
      {
        gig_id: opts.gigId,
        user_id: opts.userId,
        experience_bio: bio || null,
        status: "interested",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gig_id,user_id" },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listGigInterests(gigId: string): Promise<GigInterest[]> {
  const { data, error } = await (supabase as any)
    .from("gig_interests")
    .select("id,gig_id,user_id,experience_bio,status,created_at")
    .eq("gig_id", gigId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as GigInterest[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url, gig_experience_bio")
    .in("user_id", ids);
  const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  return rows.map((r) => {
    const p = map.get(r.user_id);
    return {
      ...r,
      experience_bio: r.experience_bio || p?.gig_experience_bio || null,
      display_name: p?.display_name || "User",
      avatar_url: p?.avatar_url || null,
    };
  });
}

/** Host approves a helper — removes gig from Opportunities (status → assigned). */
export async function approveGigHelper(opts: {
  gigId: string;
  posterId: string;
  helperId: string;
}) {
  const { error } = await (supabase as any)
    .from("gig_listings")
    .update({
      assigned_to: opts.helperId,
      status: "assigned",
    })
    .eq("id", opts.gigId)
    .eq("poster_id", opts.posterId)
    .eq("status", "open");
  if (error) throw error;

  await (supabase as any)
    .from("gig_interests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("gig_id", opts.gigId)
    .eq("user_id", opts.helperId);

  await (supabase as any)
    .from("gig_interests")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("gig_id", opts.gigId)
    .neq("user_id", opts.helperId)
    .eq("status", "interested");
}
