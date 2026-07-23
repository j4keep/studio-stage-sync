import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { APPLICATION_STATUS, formatSalary, timeAgo } from "@/lib/jobs";

type Tab = "applied" | "saved" | "posted";

export default function MyJobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("applied");
  const [applied, setApplied] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [posted, setPosted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [a, s, p] = await Promise.all([
        supabase.from("job_applications").select("id,status,created_at,job:job_listings(id,title,location,salary_min,salary_max)")
          .eq("applicant_id", user.id).order("created_at", { ascending: false }),
        supabase.from("saved_jobs").select("id,created_at,job:job_listings(id,title,location,salary_min,salary_max,created_at)")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("job_listings").select("id,title,location,salary_min,salary_max,status,created_at")
          .eq("employer_id", user.id).order("created_at", { ascending: false }),
      ]);
      setApplied(a.data ?? []);
      setSaved(s.data ?? []);
      setPosted(p.data ?? []);
      setLoading(false);
    })();
  }, [user]);

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

      <div className="flex gap-2 px-4 py-3 border-b border-border">
        {(["applied", "saved", "posted"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 h-8 rounded-full text-xs font-bold capitalize ${tab === t ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 pb-24">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : tab === "applied" ? (
          applied.length === 0 ? <Empty text="No applications yet." /> : (
            <>
              <AppliedFunnel apps={applied} />
              {applied.map((a) => a.job && (
                <div key={a.id} className="p-4 rounded-2xl bg-card border border-border">
                  <button onClick={() => nav(`/jobs/${a.job.id}`)} className="w-full text-left">
                    <p className="text-sm font-bold">{a.job.title}</p>
                    <p className="text-xs text-muted-foreground">{a.job.location ?? "—"}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {APPLICATION_STATUS[a.status as keyof typeof APPLICATION_STATUS] ?? a.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </div>
                  </button>
                  {a.status !== "withdrawn" && a.status !== "hired" && (
                    <button
                      onClick={async () => {
                        if (!confirm("Withdraw this application?")) return;
                        const { error } = await supabase.from("job_applications").update({ status: "withdrawn" }).eq("id", a.id);
                        if (error) return;
                        setApplied((prev) => prev.map((x) => x.id === a.id ? { ...x, status: "withdrawn" } : x));
                      }}
                      className="mt-2 text-[11px] font-semibold text-rose-500"
                    >
                      Withdraw application
                    </button>
                  )}
                </div>
              ))}
            </>
          )
        ) : tab === "saved" ? (
          saved.length === 0 ? <Empty text="Nothing saved yet." /> :
          saved.map((s) => s.job && (
            <button key={s.id} onClick={() => nav(`/jobs/${s.job.id}`)} className="w-full text-left p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm font-bold">{s.job.title}</p>
              <p className="text-xs text-muted-foreground">{s.job.location ?? "—"} · {formatSalary(s.job.salary_min, s.job.salary_max)}</p>
            </button>
          ))
        ) : (
          posted.length === 0 ? <Empty text="You haven't posted any jobs yet." /> :
          posted.map((p) => (
            <button key={p.id} onClick={() => nav(`/jobs/${p.id}`)} className="w-full text-left p-4 rounded-2xl bg-card border border-border">
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

function AppliedFunnel({ apps }: { apps: any[] }) {
  const counts: Record<string, number> = {};
  for (const a of apps) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  const colors: Record<string, string> = {
    applied: "bg-sky-500",
    reviewed: "bg-violet-500",
    interview: "bg-amber-500",
    offered: "bg-emerald-500",
    hired: "bg-emerald-600",
    rejected: "bg-rose-500",
    withdrawn: "bg-muted-foreground/50",
  };
  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-1.5 mb-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Your pipeline</p>
      {Object.entries(APPLICATION_STATUS).map(([k, label]) => {
        const n = counts[k] ?? 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[11px] w-20 text-muted-foreground">{label}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`${colors[k] ?? "bg-primary"} h-full rounded-full`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-[11px] font-bold w-5 text-right">{n}</span>
          </div>
        );
      })}
    </div>
  );
}
