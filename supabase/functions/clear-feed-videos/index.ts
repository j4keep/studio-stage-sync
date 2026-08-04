import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * One-shot cleanup: wipe every homepage feed video post (Posts + Reels rails).
 * Uses service role so RLS owner checks do not block the clear.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: videos, error: listError } = await supabase
    .from("posts")
    .select("id")
    .eq("media_type", "video");

  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = (videos || []).map((row: { id: string }) => row.id);
  if (ids.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, likesCleared: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: likesError, count: likesCleared } = await supabase
    .from("likes")
    .delete({ count: "exact" })
    .eq("content_type", "post")
    .in("content_id", ids);

  if (likesError) {
    return new Response(JSON.stringify({ error: likesError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // post_comments cascade via FK ON DELETE CASCADE
  const { error: postsError, count: deleted } = await supabase
    .from("posts")
    .delete({ count: "exact" })
    .eq("media_type", "video");

  if (postsError) {
    return new Response(JSON.stringify({ error: postsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ deleted: deleted ?? ids.length, likesCleared: likesCleared ?? 0, ids }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
