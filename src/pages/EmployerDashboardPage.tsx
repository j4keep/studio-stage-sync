import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Users, TrendingUp, Building2, BadgeCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { APPLICATION_STATUS, timeAgo } from "@/lib/jobs";

type JobStat = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  location: string | null;
  apps_count: number;
  new_count: number;
};

export default function EmployerDashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [company, setCompany] = useState({ company_name: "", description: "", website: "" });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: myJobs } = await supabase.from("job_listings")
        .select("id,title,status,created_at,location")
        .eq("employer_id", user.id).order("created_at", { ascending: false });

      const stats: JobStat[] = [];
      for (const j of myJobs ?? []) {
        const { count: apps_count } = await supabase.from("job_applications")
          .select("id", { count: "exact", head: true }).eq("job_id", j.id);
        const { count: new_count } = await supabase.from("job_applications")
          .select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("status", "applied");
        stats.push({ ...j, apps_count: apps_count ?? 0, new_count: new_count ?? 0 });
      }
      setJobs(stats);

      const { data: emp } = await supabase.from("employer_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (emp) {
        setCompanyId(emp.id);
        setCompany({ company_name: emp.company_name || "", description: emp.description || "", website: emp.website || "" });
      }
      setLoading(false);
    })();
  }, [user]);

  const openJob = async (jobId: string) => {
    setSelectedJob(jobId);
    const { data } = await supabase.from("job_applications")
      .select("id,status,cover_letter,created_at,applicant_id")
      .eq("job_id", jobId).order("created_at", { ascending: false });
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((a: any) => a.applicant_id)));
    let profileMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids);
      profileMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    }
    setApps(rows.map((a: any) => ({ ...a, applicant: profileMap[a.applicant_id] })));
  };

  const updateAppStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", appId);
    if (error) return toast.error(error.message);
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    toast.success("Application updated");
  };

  const toggleJobStatus = async (job: JobStat) => {
    const next = job.status === "open" ? "closed" : "open";
    const { error } = await supabase.from("job_listings").update({ status: next }).eq("id", job.id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: next } : j));
  };

  const saveCompany = async () => {
    if (!user) return;
    if (!company.company_name.trim()) return toast.error("Company name required");
    const payload = { user_id: user.id, ...company };
    const q = companyId
      ? supabase.from("employer_profiles").update(payload).eq("id", companyId)
      : supabase.from("employer_profiles").insert(payload).select("id").single();
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    if (!companyId && data && (data as any).id) setCompanyId((data as any).id);
    toast.success("Company saved");
    setShowCompany(false);
  };

  const totalApps = jobs.reduce((s, j) => s + j.apps_count, 0);
  const newApps = jobs.reduce((s, j) => s + j.new_count, 0);
  const activeJobs = jobs.filter((j) => j.status === "open").length;

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-2 px-3 py-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-bold flex-1">Employer Dashboard</h1>
        <button onClick={() => setShowCompany(true)} className="h-8 px-3 rounded-full bg-muted text-[11px] font-bold flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Company
        </button>
      </header>

      <div className="p-4 space-y-4 pb-24">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Briefcase className="w-4 h-4" />} label="Active jobs" value={activeJobs} />
          <Stat icon={<Users className="w-4 h-4" />} label="Total applicants" value={totalApps} />
          <Stat icon={<TrendingUp className="w-4 h-4" />} label="New" value={newApps} highlight />
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No jobs posted yet.</p>
            <button onClick={() => nav("/jobs")} className="mt-3 h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              Post your first job
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-2xl bg-card border border-border overflow-hidden">
                <button onClick={() => openJob(j.id)} className="w-full text-left p-4 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{j.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${j.status === "open" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {j.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{j.location ?? "—"} · {timeAgo(j.created_at)}</p>
                    <div className="mt-2 flex gap-3 text-[11px]">
                      <span><span className="font-bold text-foreground">{j.apps_count}</span> applicants</span>
                      {j.new_count > 0 && <span className="text-primary font-bold">{j.new_count} new</span>}
                    </div>
                  </div>
                </button>
                {selectedJob === j.id && (
                  <div className="border-t border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => toggleJobStatus(j)} className="text-[11px] px-2 h-7 rounded-full bg-card border border-border font-semibold">
                        {j.status === "open" ? "Close job" : "Reopen job"}
                      </button>
                      <button onClick={() => nav(`/jobs/${j.id}`)} className="text-[11px] px-2 h-7 rounded-full bg-card border border-border font-semibold">
                        View public
                      </button>
                    </div>
                    {apps.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No applicants yet.</p>
                    ) : (
                      apps.map((a) => (
                        <div key={a.id} className="rounded-xl bg-card border border-border p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold">{a.applicant?.display_name ?? "Applicant"}</p>
                              <p className="text-[10px] text-muted-foreground">{timeAgo(a.created_at)}</p>
                            </div>
                            <select value={a.status} onChange={(e) => updateAppStatus(a.id, e.target.value)}
                              className="h-8 rounded-full bg-muted border border-border px-2 text-[11px] font-semibold outline-none">
                              {Object.entries(APPLICATION_STATUS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                          {a.cover_letter && (
                            <p className="text-xs mt-2 whitespace-pre-wrap text-muted-foreground leading-relaxed">{a.cover_letter}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setShowCompany(false)}>
          <div className="w-full bg-background rounded-t-3xl p-5 pb-8 max-w-lg mx-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Company profile</h3>
            <div className="space-y-3">
              <input value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                placeholder="Company name" className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none" />
              <textarea value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })}
                placeholder="Short description" rows={3} className="w-full rounded-xl bg-muted border border-border p-3 text-sm outline-none" />
              <input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })}
                placeholder="Website (optional)" className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none" />
              <button onClick={saveCompany} className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1.5 ${highlight ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {icon}
      </div>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
