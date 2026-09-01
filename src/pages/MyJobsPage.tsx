import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Sparkles, Video, Phone, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatSalary, timeAgo, applicationStatusLabel, normalizeAppStatus, notifyJobEmployer } from "@/lib/jobs";
import {
  formatInterviewWhen,
  getInterviewInvite,
  interviewJoinState,
} from "@/lib/job-interview";
import { toast } from "sonner";

type Tab = "applied" | "interviews" | "saved" | "posted";

export default function MyJobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("applied");
  const [applied, setApplied] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [posted, setPosted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, s, p] = await Promise.all([
      supabase.from("job_applications")
        .select("id,status,created_at,job_id,applicant_accepted,references_json,job:job_listings(id,title,location,salary_min,salary_max)")
        .eq("applicant_id", user.id).order("created_at", { ascending: false }),
      supabase.from("saved_jobs").select("id,created_at,job_id,job:job_listings(id,title,location,salary_min,salary_max,created_at)")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("job_listings").select("id,title,location,salary_min,salary_max,status,created_at")
        .eq("employer_id", user.id).order("created_at", { ascending: false }),
    ]);
    setApplied((a.data ?? []).filter((row: any) => row.job));
    setSaved((s.data ?? []).filter((row: any) => row.job));
    setPosted(p.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-job-apps-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_applications", filter: `applicant_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as Record<string, unknown> & { id: string };
          setApplied((prev) => prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)));
          if (next.status === "interview") {
            toast.message("Interview invite — check Interviews tab");
            setTab("interviews");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "job_applications", filter: `applicant_id=eq.${user.id}` },
        (payload) => {
          const old = payload.old as { id?: string; job_id?: string };
          setApplied((prev) => prev.filter((x) => x.id !== old.id && x.job_id !== old.job_id));
          toast.message("A job you applied to was removed by the employer");
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "saved_jobs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const old = payload.old as { id?: string; job_id?: string };
          setSaved((prev) => prev.filter((x) => x.id !== old.id && x.job_id !== old.job_id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const interviews = useMemo(
    () => applied.filter((a) => normalizeAppStatus(a.status) === "interview" && getInterviewInvite(a)),
    [applied],
  );

  const acceptInterview = async (appId: string) => {
    const { error } = await supabase.from("job_applications").update({ applicant_accepted: true }).eq("id", appId);
    if (error) return toast.error(error.message);
    setApplied((prev) => prev.map((x) => (x.id === appId ? { ...x, applicant_accepted: true } : x)));
    void notifyJobEmployer(appId, "interview_accepted");
    toast.success("Interview accepted — the employer has been notified");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-2 px-3 py-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-bold flex-1">My Jobs</h1>
        <button onClick={() => nav("/resume-builder")} className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Resume
        </button>
      </header>

      <div className="h-scroll-isolate flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {([
          ["applied", "Applied"],
          ["interviews", `Interviews${interviews.length ? ` (${interviews.length})` : ""}`],
          ["saved", "Saved"],
          ["posted", "Posted"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold ${tab === t ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 pb-24">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : tab === "interviews" ? (
          interviews.length === 0 ? <Empty text="No interview invites yet." /> : (
            interviews.map((a) => {
              const invite = getInterviewInvite(a)!;
              const state = interviewJoinState({
                invite,
                applicantAccepted: !!a.applicant_accepted,
              });
              return (
                <div key={a.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
                  <div>
                    <p className="text-sm font-bold">{a.job.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.job.location ?? "—"}</p>
                  </div>

                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1">
                      {invite.call_kind === "video" ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                      {invite.call_kind === "video" ? "Video" : "Audio"} interview invite
                    </p>
                    <p className="text-xs"><span className="text-muted-foreground">When:</span> {formatInterviewWhen(invite.at)}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Join by:</span> {formatInterviewWhen(invite.join_deadline)}</p>
                  </div>

                  {!a.applicant_accepted && state !== "expired" && (
                    <button
                      onClick={() => acceptInterview(a.id)}
                      className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Accept interview
                    </button>
                  )}

                  {a.applicant_accepted && state === "open" && (
                    <button
                      onClick={() => nav(`/jobs/interview/${a.id}`)}
                      className="w-full h-11 rounded-full bg-emerald-500 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      {invite.call_kind === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      Join meeting
                    </button>
                  )}

                  {a.applicant_accepted && state === "open" && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Accepted ✓ — you can join anytime before {formatInterviewWhen(invite.join_deadline)}.
                    </p>
                  )}

                  {invite.external_url && a.applicant_accepted && state !== "expired" && (
                    <a href={invite.external_url} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-primary">
                      Or open external call link
                    </a>
                  )}

                  {state === "expired" && (
                    <p className="text-[11px] text-rose-500 text-center">Join deadline passed</p>
                  )}
                </div>
              );
            })
          )
        ) : tab === "applied" ? (
          applied.length === 0 ? <Empty text="No applications yet." /> : (
            applied.map((a) => (
              <div key={a.id} className="p-4 rounded-2xl bg-card border border-border">
                <button onClick={() => nav(`/jobs/${a.job.id}`)} className="w-full text-left">
                  <p className="text-sm font-bold">{a.job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.job.location ?? "—"} · {formatSalary(a.job.salary_min, a.job.salary_max)}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusTone(a.status)}`}>
                      {applicationStatusLabel(a.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                </button>
                {(() => {
                  if (normalizeAppStatus(a.status) !== "interview") return null;
                  const invite = getInterviewInvite(a);
                  if (!invite) return null;
                  const state = interviewJoinState({ invite, applicantAccepted: !!a.applicant_accepted });
                  return (
                    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1">
                        {invite.call_kind === "video" ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                        {invite.call_kind === "video" ? "Video" : "Phone"} interview · {formatInterviewWhen(invite.at)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Join by {formatInterviewWhen(invite.join_deadline)}
                      </p>
                      {state === "expired" ? (
                        <p className="text-[11px] font-semibold text-rose-500">Join deadline passed</p>
                      ) : !a.applicant_accepted ? (
                        <button
                          onClick={() => acceptInterview(a.id)}
                          className="w-full h-10 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> Accept interview
                        </button>
                      ) : (
                        <button
                          onClick={() => nav(`/jobs/interview/${a.id}`)}
                          className="w-full h-10 rounded-full bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          {invite.call_kind === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                          Join meeting
                        </button>
                      )}
                    </div>
                  );
                })()}

                {a.status !== "withdrawn" && a.status !== "hired" && a.status !== "rejected" && (
                  <button
                    onClick={async () => {
                      if (!confirm("Withdraw this application?")) return;
                      const { error } = await supabase.from("job_applications").update({ status: "withdrawn" }).eq("id", a.id);
                      if (error) return;
                      void notifyJobEmployer(a.id, "withdrawn");
                      setApplied((prev) => prev.map((x) => x.id === a.id ? { ...x, status: "withdrawn" } : x));
                    }}
                    className="mt-2 text-[11px] font-semibold text-rose-500"
                  >
                    Withdraw application
                  </button>
                )}
              </div>
            ))
          )
        ) : tab === "saved" ? (
          saved.length === 0 ? <Empty text="Nothing saved yet." /> :
          saved.map((s) => (
            <button key={s.id} onClick={() => nav(`/jobs/${s.job.id}`)} className="w-full text-left p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm font-bold">{s.job.title}</p>
              <p className="text-xs text-muted-foreground">{s.job.location ?? "—"} · {formatSalary(s.job.salary_min, s.job.salary_max)}</p>
            </button>
          ))
        ) : (
          posted.length === 0 ? <Empty text="You haven't posted any jobs yet." /> :
          posted.map((p) => (
            <button key={p.id} onClick={() => nav(`/employer-dashboard`)} className="w-full text-left p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.location ?? "—"} · {formatSalary(p.salary_min, p.salary_max)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p.status === "open" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {p.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-12">
      <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function statusTone(status: string): string {
  const s = normalizeAppStatus(status);
  if (s === "hired" || s === "offered") return "bg-emerald-500/15 text-emerald-600";
  if (s === "interview") return "bg-amber-500/15 text-amber-700";
  if (s === "rejected") return "bg-rose-500/15 text-rose-600";
  if (s === "withdrawn") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
}
