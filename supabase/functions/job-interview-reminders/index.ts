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

type Invite = {
  at?: string;
  join_deadline?: string;
  call_kind?: string;
  reminder_10_sent?: boolean;
};

/** Sends a 10-minute-before reminder to both employer and applicant for scheduled interviews. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const { data: apps, error } = await admin
      .from("job_applications")
      .select("id, applicant_id, job_id, references_json, status")
      .eq("status", "interview")
      .limit(500);
    if (error) return json({ error: error.message }, 500);

    let sent = 0;

    for (const app of apps ?? []) {
      const refs = app.references_json;
      if (!refs || typeof refs !== "object" || Array.isArray(refs)) continue;
      const invite = (refs as Record<string, unknown>).yaj_interview as Invite | undefined;
      if (!invite?.at || invite.reminder_10_sent) continue;

      const startsAt = new Date(invite.at).getTime();
      if (Number.isNaN(startsAt)) continue;
      const minutesAway = (startsAt - now) / 60_000;
      // fire inside the window 0..11 minutes before start
      if (minutesAway > 11 || minutesAway < -1) continue;

      const { data: job } = await admin
        .from("job_listings")
        .select("id, title, employer_id")
        .eq("id", app.job_id)
        .maybeSingle();
      if (!job) continue;

      const kind = invite.call_kind === "audio" ? "phone" : "video";
      const title = "Interview in 10 minutes";
      const rows = [
        {
          user_id: app.applicant_id,
          type: "job",
          title,
          body: `Your ${kind} interview for ${job.title || "a job"} starts in about 10 minutes. Open My Jobs → Interviews to join.`,
          reference_id: job.id,
          reference_type: "job",
        },
      ];
      if (job.employer_id && job.employer_id !== app.applicant_id) {
        rows.push({
          user_id: job.employer_id,
          type: "job",
          title,
          body: `Your ${kind} interview for ${job.title || "your job post"} starts in about 10 minutes. Open your hiring pipeline to start the meeting.`,
          reference_id: job.id,
          reference_type: "job",
        });
      }

      const { error: insErr } = await admin.from("notifications").insert(rows);
      if (insErr) continue;

      await admin
        .from("job_applications")
        .update({
          references_json: {
            ...(refs as Record<string, unknown>),
            yaj_interview: { ...invite, reminder_10_sent: true },
          },
        })
        .eq("id", app.id);

      sent += rows.length;
    }

    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
