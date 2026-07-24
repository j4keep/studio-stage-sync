import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { application_id } = await req.json();
    if (!application_id || typeof application_id !== "string") {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: app, error: appErr } = await admin
      .from("job_applications")
      .select("id, applicant_id, job_id, status, references_json")
      .eq("id", application_id)
      .maybeSingle();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: appErr?.message || "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await admin
      .from("job_listings")
      .select("id, title, employer_id")
      .eq("id", app.job_id)
      .maybeSingle();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.employer_id !== callerId) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefs } = await admin
      .from("job_preferences")
      .select("notify_frequency")
      .eq("user_id", app.applicant_id)
      .maybeSingle();

    if (prefs?.notify_frequency && String(prefs.notify_frequency).toLowerCase() === "off") {
      return new Response(JSON.stringify({ ok: true, skipped: "prefs_off" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refs = app.references_json;
    const hasInterview =
      app.status === "interview" &&
      refs &&
      typeof refs === "object" &&
      !Array.isArray(refs) &&
      Object.prototype.hasOwnProperty.call(refs, "yaj_interview");

    const statusLabel: Record<string, string> = {
      applied: "Reviewing",
      reviewing: "Reviewing",
      interview: "Interview",
      offered: "Offered",
      hired: "Hired",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
    };

    let title: string;
    let body: string;
    if (hasInterview) {
      title = "Interview invite";
      body = `You have an interview invite for ${job.title || "a job"}. Open My Jobs → Interviews to accept and join.`;
    } else {
      const label = statusLabel[app.status] || app.status;
      title = `Job application — ${label}`;
      body = `Your application for ${job.title || "a job"} is now: ${label}.`;
    }

    const since = new Date(Date.now() - 20_000).toISOString();
    const { data: recent } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", app.applicant_id)
      .eq("reference_id", app.job_id)
      .eq("title", title)
      .gt("created_at", since)
      .limit(1);

    if (recent?.length) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await admin.from("notifications").insert({
      user_id: app.applicant_id,
      type: "job",
      title,
      body,
      reference_id: app.job_id,
      reference_type: "job",
    });

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
