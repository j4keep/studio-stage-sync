import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Users, TrendingUp, Building2, BadgeCheck, ShieldCheck, ChevronDown, ChevronUp, Upload, Pencil, FileText, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { APPLICATION_STATUS, normalizeAppStatus, notifyJobApplicant, timeAgo } from "@/lib/jobs";
import ApplicationPhaseDots from "@/components/jobs/ApplicationPhaseDots";
import PostJobSheet, { type EditableJob } from "@/components/jobs/PostJobSheet";
import ResumePreview from "@/components/jobs/ResumePreview";
import ScheduleInterviewSheet from "@/components/jobs/ScheduleInterviewSheet";
import { formatInterviewWhen, getInterviewInvite } from "@/lib/job-interview";

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
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [company, setCompany] = useState({ company_name: "", description: "", website: "", logo_url: "" });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [editJob, setEditJob] = useState<EditableJob | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [interviewApp, setInterviewApp] = useState<any | null>(null);

  const loadJobs = async () => {
    if (!user) return;
    setLoading(true);
    const { data: myJobs } = await supabase.from("job_listings")
      .select("id,title,status,created_at,location")
      .eq("employer_id", user.id).order("created_at", { ascending: false });

    const stats: JobStat[] = [];
    for (const j of myJobs ?? []) {
      const { count: apps_count } = await supabase.from("job_applications")
        .select("id", { count: "exact", head: true }).eq("job_id", j.id);
      const { count: reviewing_count } = await supabase.from("job_applications")
        .select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("status", "reviewing");
      const { count: applied_count } = await supabase.from("job_applications")
        .select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("status", "applied");
      stats.push({
        ...j,
        apps_count: apps_count ?? 0,
        new_count: (reviewing_count ?? 0) + (applied_count ?? 0),
      });
    }
    setJobs(stats);

    const { data: emp } = await supabase.from("employer_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (emp) {
      setCompanyId(emp.id);
      setCompany({
        company_name: emp.company_name || "",
        description: emp.description || "",
        website: emp.website || "",
        logo_url: emp.logo_url || "",
      });
      setVerified(!!emp.verified);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadJobs();
  }, [user]);

  const requestVerification = async () => {
    if (!user) return;
    if (!company.company_name.trim() && !company.logo_url) {
      toast.error("Add a company name or logo first");
      setShowCompany(true);
      return;
    }
    setRequesting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: `🪪 Business verification — ${company.company_name || "Logo only"}`,
      message: `Please verify business account.\nCompany: ${company.company_name || "—"}\nWebsite: ${company.website || "—"}\nDescription: ${company.description || "—"}`,
      status: "open",
    });
    setRequesting(false);
    if (error) return toast.error(error.message);
    toast.success("Verification requested — we'll review shortly");
  };

  const loadApps = async (jobId: string) => {
    setExpandedApp(null);
    const { data } = await supabase.from("job_applications")
      .select("*")
      .eq("job_id", jobId).order("created_at", { ascending: false });
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((a: any) => a.applicant_id)));
    let profileMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids);
      profileMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    }
    setApps(rows.map((a: any) => ({
      ...a,
      status: normalizeAppStatus(a.status),
      applicant: profileMap[a.applicant_id],
    })));
  };

  const openJob = async (jobId: string) => {
    if (selectedJob === jobId) {
      setSelectedJob(null);
      setExpandedApp(null);
      return;
    }
    setSelectedJob(jobId);
    await loadApps(jobId);
  };

  const updateAppStatus = async (appId: string, status: string) => {
    if (status === "interview") {
      const app = apps.find((a) => a.id === appId);
      if (app) setInterviewApp(app);
      return;
    }
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", appId);
    if (error) return toast.error(error.message);
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    const notified = await notifyJobApplicant(appId);
    toast.success(notified.ok ? "Status updated — applicant notified" : "Status updated");
    if (!notified.ok && notified.error && !/could not find|does not exist|404/i.test(notified.error)) {
      console.warn("Applicant notify failed:", notified.error);
    }
  };

  const saveInterviewInvite = async (payload: {
    status: "interview";
    applicant_accepted: boolean;
    references_json: Record<string, unknown>;
  }) => {
    if (!interviewApp) return;
    const { error } = await supabase.from("job_applications").update(payload as any).eq("id", interviewApp.id);
    if (error) return toast.error(error.message);
    setApps((prev) => prev.map((a) => a.id === interviewApp.id ? { ...a, ...payload } : a));
    const appId = interviewApp.id;
    setInterviewApp(null);
    const notified = await notifyJobApplicant(appId);
    toast.success(
      notified.ok
        ? "Interview invite sent — applicant can accept in My Jobs"
        : "Interview saved — notification may be delayed until DB sync",
    );
  };

  const toggleJobStatus = async (job: JobStat) => {
    const next = job.status === "open" ? "closed" : "open";
    const { error } = await supabase.from("job_listings").update({ status: next }).eq("id", job.id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: next } : j));
  };

  const deleteJob = async (job: JobStat) => {
    if (!confirm(`Delete "${job.title}"? This can't be undone.`)) return;
    const { error } = await supabase.from("job_listings").delete().eq("id", job.id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    if (selectedJob === job.id) setSelectedJob(null);
    toast.success("Job deleted — removed from applicants’ lists too");
  };

  const startEditJob = async (jobId: string) => {
    const { data, error } = await supabase.from("job_listings").select("*").eq("id", jobId).maybeSingle();
    if (error || !data) return toast.error(error?.message || "Could not load job");
    setEditJob(data as EditableJob);
    setShowEditSheet(true);
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    setUploadingLogo(true);
    const path = `employer-logos/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      setUploadingLogo(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    setCompany((c) => ({ ...c, logo_url: pub.publicUrl }));
    setUploadingLogo(false);
    toast.success("Logo uploaded");
  };

  const saveCompany = async () => {
    if (!user) return;
    if (!company.company_name.trim() && !company.logo_url) {
      return toast.error("Add a business name or upload a company logo");
    }
    const payload = {
      user_id: user.id,
      company_name: company.company_name.trim() || "Business",
      description: company.description,
      website: company.website,
      logo_url: company.logo_url || null,
    };
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
        <h1 className="text-base font-bold flex-1 flex items-center gap-1">
          Employer Dashboard
          {verified && <BadgeCheck className="w-4 h-4 text-sky-500" aria-label="Verified" />}
        </h1>
        <button onClick={() => setShowCompany(true)} className="h-8 px-3 rounded-full bg-muted text-[11px] font-bold flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Company
        </button>
      </header>

      <div className="p-4 space-y-4 pb-24">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Briefcase className="w-4 h-4" />} label="Active jobs" value={activeJobs} />
          <Stat icon={<Users className="w-4 h-4" />} label="Total applicants" value={totalApps} />
          <Stat icon={<TrendingUp className="w-4 h-4" />} label="Reviewing" value={newApps} highlight />
        </div>

        {!verified && (
          <button
            onClick={requestVerification}
            disabled={requesting}
            className="w-full flex items-center justify-between gap-2 p-3 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold">Get the verified badge</p>
                <p className="text-[11px] text-muted-foreground">Build trust — verified badge shows on all your jobs.</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-sky-600 shrink-0">{requesting ? "Sending…" : "Request"}</span>
          </button>
        )}

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
                      {j.new_count > 0 && <span className="text-primary font-bold">{j.new_count} reviewing</span>}
                    </div>
                  </div>
                </button>
                {selectedJob === j.id && (
                  <div className="border-t border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => startEditJob(j.id)} className="text-[11px] px-2 h-7 rounded-full bg-card border border-border font-semibold inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit job
                      </button>
                      <button onClick={() => toggleJobStatus(j)} className="text-[11px] px-2 h-7 rounded-full bg-card border border-border font-semibold">
                        {j.status === "open" ? "Close job" : "Reopen job"}
                      </button>
                      <button onClick={() => nav(`/jobs/${j.id}`)} className="text-[11px] px-2 h-7 rounded-full bg-card border border-border font-semibold">
                        View public
                      </button>
                      <button onClick={() => deleteJob(j)} className="text-[11px] px-2 h-7 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30 font-semibold">
                        Delete
                      </button>
                    </div>
                    {apps.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No applicants yet.</p>
                    ) : apps.map((a) => {
                      const open = expandedApp === a.id;
                      return (
                        <div key={a.id} className="rounded-xl bg-card border border-border overflow-hidden">
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedApp(open ? null : a.id)}
                                className="min-w-0 text-left flex-1"
                              >
                                <p className="text-sm font-bold truncate">{a.full_name ?? a.applicant?.display_name ?? "Applicant"}</p>
                                <p className="text-[10px] text-muted-foreground">{timeAgo(a.created_at)}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedApp(open ? null : a.id)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
                                aria-label={open ? "Collapse application" : "Open full application"}
                              >
                                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <ApplicationPhaseDots status={a.status} mode="employer" />
                              <select
                                value={normalizeAppStatus(a.status)}
                                onChange={(e) => updateAppStatus(a.id, e.target.value)}
                                className="h-8 rounded-full bg-muted border border-border px-2 text-[11px] font-semibold outline-none"
                              >
                                {Object.entries(APPLICATION_STATUS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              {normalizeAppStatus(a.status) === "interview" && (
                                <button
                                  type="button"
                                  onClick={() => setInterviewApp(a)}
                                  className="h-8 px-2 rounded-full bg-amber-500/15 text-amber-700 text-[11px] font-bold inline-flex items-center gap-1"
                                >
                                  <Video className="w-3 h-3" />
                                  {getInterviewInvite(a) ? "Edit interview" : "Schedule"}
                                </button>
                              )}
                              {(a.resume_url || a.resume_snapshot) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                                  <FileText className="w-3 h-3" /> Résumé
                                </span>
                              )}
                            </div>
                            {getInterviewInvite(a) && (
                              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-2.5 space-y-2">
                                <p className="text-[10px] text-muted-foreground">
                                  Interview {formatInterviewWhen(getInterviewInvite(a)!.at)} · join by {formatInterviewWhen(getInterviewInvite(a)!.join_deadline)}
                                  {a.applicant_accepted ? " · Applicant accepted ✓" : " · Waiting for applicant to accept"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => nav(`/jobs/interview/${a.id}`)}
                                  className="w-full h-10 rounded-full bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Start meeting
                                </button>
                              </div>
                            )}
                          </div>

                          {open && <ApplicationDetail a={a} />}
                        </div>
                      );
                    })}
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
            <h3 className="font-bold mb-1">Company profile</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Applicants see your business name and/or logo on the job and application.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-muted border border-border text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? "Uploading…" : company.logo_url ? "Replace logo" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploadingLogo}
                    onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  />
                </label>
              </div>
              <input value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                placeholder="Business name *" className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none" />
              <textarea value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })}
                placeholder="Short description" rows={3} className="w-full rounded-xl bg-muted border border-border p-3 text-sm outline-none" />
              <input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })}
                placeholder="Website (optional)" className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none" />
              <p className="text-[11px] text-muted-foreground">Business name or logo required.</p>
              <button onClick={saveCompany} className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <PostJobSheet
        open={showEditSheet}
        editJob={editJob}
        onClose={() => { setShowEditSheet(false); setEditJob(null); }}
        onCreated={() => { loadJobs(); if (selectedJob) loadApps(selectedJob); }}
      />

      <ScheduleInterviewSheet
        open={!!interviewApp}
        applicantName={interviewApp?.full_name ?? interviewApp?.applicant?.display_name ?? "Applicant"}
        applicationId={interviewApp?.id ?? ""}
        existingRefs={interviewApp?.references_json}
        onClose={() => setInterviewApp(null)}
        onScheduled={(payload) => {
          void saveInterviewInvite({
            status: payload.status,
            applicant_accepted: payload.applicant_accepted,
            references_json: payload.references_json,
          });
        }}
      />
    </div>
  );
}

function ApplicationDetail({ a }: { a: any }) {
  const history = Array.isArray(a.employment_history) ? a.employment_history : [];
  const education = Array.isArray(a.education_history) ? a.education_history : [];
  const skills = Array.isArray(a.application_skills) ? a.application_skills : [];
  const certs = Array.isArray(a.certifications) ? a.certifications : [];
  const hasResumeFile = !!a.resume_url;
  const hasResumeBody = !!(a.resume_snapshot && typeof a.resume_snapshot === "object");

  return (
    <div className="border-t border-border p-3 space-y-3 bg-muted/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
        {a.email && <a href={`mailto:${a.email}`} className="truncate hover:text-primary">✉︎ {a.email}</a>}
        {a.phone && <a href={`tel:${a.phone}`} className="truncate hover:text-primary">☎ {a.phone}</a>}
        {a.address && <span className="sm:col-span-2">📍 {a.address}</span>}
        {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noreferrer" className="truncate hover:text-primary">🌐 Portfolio</a>}
        {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="truncate hover:text-primary">in LinkedIn</a>}
        {a.years_experience != null && <span>🕒 {a.years_experience} yrs experience</span>}
        {a.availability && <span>📅 {a.availability}</span>}
        {a.available_start_date && <span>🗓 Start: {a.available_start_date}</span>}
        {a.shift_preference && <span>⏰ Shift: {a.shift_preference}</span>}
        {a.work_authorized != null && <span>{a.work_authorized ? "✓ Work authorized" : "✗ Not work authorized"}</span>}
        {a.willing_to_relocate != null && <span>{a.willing_to_relocate ? "Willing to relocate" : "Not relocating"}</span>}
      </div>

      {(hasResumeFile || hasResumeBody) && (
        <DetailBlock title="Résumé">
          <div className="space-y-2">
            {hasResumeFile && (
              <a
                href={a.resume_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-primary-foreground text-[11px] font-bold"
              >
                <FileText className="w-3.5 h-3.5" />
                Open résumé file
              </a>
            )}
            {hasResumeBody && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {hasResumeFile ? "Also attached as readable résumé:" : "YAJ AI résumé attached — read below:"}
                </p>
                <ResumePreview data={a.resume_snapshot} />
              </>
            )}
          </div>
        </DetailBlock>
      )}

      {skills.length > 0 && (
        <DetailBlock title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-semibold">{s}</span>
            ))}
          </div>
        </DetailBlock>
      )}

      {certs.length > 0 && (
        <DetailBlock title="Qualifications & certifications">
          <div className="flex flex-wrap gap-1.5">
            {certs.map((c: string) => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">{c}</span>
            ))}
          </div>
        </DetailBlock>
      )}

      {history.length > 0 && (
        <DetailBlock title="Employment history">
          <div className="space-y-2">
            {history.map((h: any, i: number) => (
              <div key={i} className="rounded-lg bg-background/80 border border-border p-2 text-[11px]">
                <p className="font-bold text-foreground">{h.title || "Role"} · {h.employer || "Employer"}</p>
                <p className="text-muted-foreground">{[h.start, h.end].filter(Boolean).join(" → ") || "Dates n/a"}</p>
                {h.supervisor && <p>Supervisor: {h.supervisor}{h.phone ? ` · ${h.phone}` : ""}</p>}
                {h.pay && <p>Pay: {h.pay}</p>}
                {h.reason && <p>Left: {h.reason}</p>}
              </div>
            ))}
          </div>
        </DetailBlock>
      )}

      {education.length > 0 && (
        <DetailBlock title="Education">
          <div className="space-y-1.5">
            {education.map((e: any, i: number) => (
              <p key={i} className="text-[11px]">
                <span className="font-semibold text-foreground">{e.school}</span>
                {e.degree ? ` — ${e.degree}` : ""}
                {e.year ? ` (${e.year})` : ""}
              </p>
            ))}
          </div>
        </DetailBlock>
      )}

      {a.cover_letter && (
        <DetailBlock title="Cover letter">
          <p className="text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">{a.cover_letter}</p>
        </DetailBlock>
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {children}
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
