import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Try both possible env var names for the anon key
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!anonKey) {
      console.error("Available env vars:", Object.keys(Deno.env.toObject()).filter(k => k.startsWith("SUPABASE")));
      return new Response(JSON.stringify({ error: "Server config error: missing anon key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!serviceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server config error: missing service key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with anon key
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for storage operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Ensure bucket exists
    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.id === "studio-photos");
    if (!bucketExists) {
      const { error: bucketError } = await adminClient.storage.createBucket("studio-photos", { public: true });
      if (bucketError) {
        console.error("Bucket creation error:", bucketError);
      }
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("studio-photos")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = adminClient.storage.from("studio-photos").getPublicUrl(path);

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
