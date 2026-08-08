import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronRight,
  FileText,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatSalary, timeAgo, EMPLOYMENT_TYPES } from "@/lib/jobs";
import PostJobSheet from "@/components/jobs/PostJobSheet";

type MyJob = {
  id: string;
  title: string;
  status: string;
  employment_type: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string;
};

/** Professional Dashboard → Opportunities (jobs & gigs you publish). */
export default function ProOpportunitiesDashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showJobSheet, setShowJobSheet] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("job_listings")
      .select("id,title,status,employment_type,location,salary_min,salary_max,created_at")
      .eq("employer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as MyJob[];
    setJobs(rows);

    if (rows.length) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("job_id")
        .in("job_id", rows.map((r) => r.id));
      const counts: Record<string, number> = {};
      (apps ?? []).forEach((a: any) => {
        counts[a.job_id] = (counts[a.job_id] || 0) + 1;
      });
      setApplicantCounts(counts);
    } else {
      setApplicantCounts({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const tools = [
    { icon: Building2, label: "Hiring pipeline", sub: "Review, interview & hire applicants", route: "/employer-dashboard" },
    { icon: FileText, label: "Resume", sub: "Build, upload & manage your resume", route: "/resume-builder" },
    { icon: Briefcase, label: "My applications", sub: "Track jobs you applied to", route: "/my-jobs" },
    { icon: Settings2, label: "Job preferences", sub: "Match settings & alerts", route: "/job-preferences" },
  ];

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/pro")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Professional Dashboard</p>
            <h1 className="truncate text-lg font-black tracking-tight">Opportunities</h1>
          </div>
        </div>
      </header>

      <section className="px-4 pt-4">
        <button
          type="button"
          onClick={() => setShowJobSheet(true)}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.98]"
        >
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Plus className="h-4 w-4 text-primary" />
          </span>
          <p className="text-[15px] font-bold leading-tight">Post a job</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Full-time, part-time, contract</p>
        </button>
      </section>

      <section className="mt-4 space-y-2 px-3">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.route}
              type="button"
              onClick={() => nav(t.route)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left hover:border-primary/40 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold leading-tight">{t.label}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{t.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </section>

      <section className="mt-6 px-4">
        <h2 className="mb-2 text-[13px] font-black uppercase tracking-wide text-muted-foreground">
          Jobs you posted
        </h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <p className="text-sm font-bold">No job posts yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Post a job to start receiving applications.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => nav(`/jobs/${j.id}`)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-snug">{j.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {j.location || "—"} · {EMPLOYMENT_TYPES.find((t) => t.id === j.employment_type)?.label}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      j.status === "open" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {j.status}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                    {formatSalary(j.salary_min, j.salary_max)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[12px] font-semibold">
                    <Users className="h-3 w-3" />
                    {applicantCounts[j.id] || 0} applicants
                  </span>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(j.created_at)} ago</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <PostJobSheet open={showJobSheet} onClose={() => setShowJobSheet(false)} onCreated={load} />
    </div>
  );
}
