import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { application_id, event } = await req.json();
    const kind = event === "interview_accepted" ? "interview_accepted"
      : event === "interview_declined" ? "interview_declined" : "applied";
    if (!application_id || typeof application_id !== "string") {
      return json({ error: "application_id required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: app } = await admin
      .from("job_applications")
      .select("id, applicant_id, job_id, full_name")
      .eq("id", application_id)
      .maybeSingle();
    if (!app) return json({ error: "Application not found" }, 404);
    if (app.applicant_id !== callerId) return json({ error: "Not authorized" }, 403);

    const { data: job } = await admin
      .from("job_listings")
      .select("id, title, employer_id")
      .eq("id", app.job_id)
      .maybeSingle();
    if (!job?.employer_id) return json({ error: "Job not found" }, 404);
    if (job.employer_id === callerId) return json({ ok: true, skipped: "self" });

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", app.applicant_id)
      .maybeSingle();

    const who = app.full_name || profile?.display_name || "Someone";
    let title = "New job application";
    let body = `${who} applied for ${job.title || "your job post"}. Open your hiring pipeline to review.`;
    if (kind === "interview_accepted") {
      title = "Interview accepted";
      body = `${who} accepted the interview for ${job.title || "your job post"}. You can start the meeting at the scheduled time.`;
    } else if (kind === "interview_declined") {
      title = "Interview declined";
      body = `${who} declined the interview for ${job.title || "your job post"}.`;
    }

    const since = new Date(Date.now() - 20_000).toISOString();
    const { data: recent } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", job.employer_id)
      .eq("reference_id", job.id)
      .eq("title", title)
      .gt("created_at", since)
      .limit(1);
    if (recent?.length) return json({ ok: true, deduped: true });

    const { error: insertErr } = await admin.from("notifications").insert({
      user_id: job.employer_id,
      type: "job",
      title,
      body,
      reference_id: job.id,
      reference_type: "job",
    });
    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
