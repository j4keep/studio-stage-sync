const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Retired launch safeguard.
 * This endpoint used to delete homepage video posts during an earlier cleanup.
 * It must never delete feed content again.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ deleted: 0, likesCleared: 0, retired: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
