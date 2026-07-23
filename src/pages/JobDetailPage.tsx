import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Bookmark, BookmarkCheck, Building2, Sparkles, Loader2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatSalary, timeAgo, EMPLOYMENT_TYPES, REMOTE_MODES } from "@/lib/jobs";
import { generateCoverLetter } from "@/lib/yaj-jobs-ai";

type Job = {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  category: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_mode: string;
  skills: string[];
  education: string | null;
  experience_level: string;
  benefits: string[];
  deadline: string | null;
  created_at: string;
};

type AppForm = {
  full_name: string;
  email: string;
  phone: string;
  portfolio_url: string;
  linkedin_url: string;
  years_experience: string;
  expected_salary: string;
  availability: string;
  work_authorized: boolean;
  willing_to_relocate: boolean;
  resume_url: string;
  cover_letter: string;
};

const emptyForm: AppForm = {
  full_name: "",
  email: "",
  phone: "",
  portfolio_url: "",
  linkedin_url: "",
  years_experience: "",
  expected_salary: "",
  availability: "",
  work_authorized: true,
  willing_to_relocate: false,
  resume_url: "",
  cover_letter: "",
};

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiGen, setAiGen] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [form, setForm] = useState<AppForm>(emptyForm);
  const [resumeSnapshot, setResumeSnapshot] = useState<any>(null);

  const set = <K extends keyof AppForm>(k: K, v: AppForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("job_listings").select("*").eq("id", id).maybeSingle();
      setJob(data as Job | null);
      setLoading(false);
      if (user && data) {
        const [{ data: s }, { data: a }, { data: p }, { data: r }] = await Promise.all([
          supabase.from("saved_jobs").select("id").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
          supabase.from("job_applications").select("id").eq("applicant_id", user.id).eq("job_id", id).maybeSingle(),
          supabase.from("profiles").select("display_name,email").eq("user_id", user.id).maybeSingle(),
          supabase.from("resumes").select("structured_data,file_url").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
        ]);
        setSaved(!!s);
        setApplied(!!a);
        setResumeSnapshot((r as any)?.structured_data ?? null);
        setForm((f) => ({
          ...f,
          full_name: p?.display_name ?? "",
          email: p?.email ?? user.email ?? "",
          resume_url: (r as any)?.file_url ?? "",
        }));
      }
    })();
  }, [id, user]);

  const toggleSave = async () => {
    if (!user || !job) return toast.error("Please sign in");
    if (saved) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", job.id);
      setSaved(false);
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: job.id });
      setSaved(true);
    }
  };

  const uploadResume = async (file: File) => {
    if (!user) return;
    setUploadingResume(true);
    const path = `resumes/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      setUploadingResume(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    set("resume_url", pub.publicUrl);
    setUploadingResume(false);
    toast.success("Résumé uploaded");
  };

  const genCoverLetter = async () => {
    if (!user || !job) return;
    setAiGen(true);
    try {
      const letter = await generateCoverLetter(
        { title: job.title, description: job.description, skills: job.skills, location: job.location },
        resumeSnapshot ?? { profile: { display_name: form.full_name } },
        form.cover_letter,
      );
      set("cover_letter", letter);
      toast.success("Cover letter drafted");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate cover letter");
    } finally {
      setAiGen(false);
    }
  };

  const submitApplication = async () => {
    if (!user || !job) return toast.error("Please sign in first");
    if (!form.full_name.trim() || !form.email.trim()) {
      return toast.error("Name and email are required");
    }
    setSubmitting(true);
    const { error } = await supabase.from("job_applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      status: "applied",
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      portfolio_url: form.portfolio_url.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      years_experience: form.years_experience ? Number(form.years_experience) : null,
      expected_salary: form.expected_salary ? Number(form.expected_salary) : null,
      availability: form.availability.trim() || null,
      work_authorized: form.work_authorized,
      willing_to_relocate: form.willing_to_relocate,
      resume_url: form.resume_url || null,
      resume_snapshot: resumeSnapshot,
      cover_letter: form.cover_letter.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setApplied(true);
    setShowApply(false);
    toast.success("Application sent!");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!job) return <div className="p-6 text-sm">Job not found.</div>;

  const empType = EMPLOYMENT_TYPES.find((t) => t.id === job.employment_type)?.label ?? job.employment_type;
  const mode = REMOTE_MODES.find((m) => m.id === job.remote_mode)?.label ?? job.remote_mode;
  const isOwner = user && job.employer_id === user.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-3 py-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={toggleSave} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4 pb-40">
        <div>
          <h1 className="text-xl md:text-3xl font-black tracking-tight">{job.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
            {job.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(job.created_at)}</span>
            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {mode}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">{empType}</span>
          <span className="px-2 py-1 rounded-full bg-muted font-semibold">{formatSalary(job.salary_min, job.salary_max)}</span>
          {job.experience_level && <span className="px-2 py-1 rounded-full bg-muted font-semibold capitalize">{job.experience_level}</span>}
        </div>

        <Section title="About the role">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{job.description}</p>
        </Section>

        {job.skills?.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s) => <span key={s} className="px-2 py-1 rounded-full bg-muted text-xs">{s}</span>)}
            </div>
          </Section>
        )}

        {job.education && <Section title="Education"><p className="text-sm">{job.education}</p></Section>}

        {job.benefits?.length > 0 && (
          <Section title="Benefits">
            <ul className="text-sm space-y-1">{job.benefits.map((b) => <li key={b}>• {b}</li>)}</ul>
          </Section>
        )}

        {job.deadline && <Section title="Application deadline"><p className="text-sm">{new Date(job.deadline).toLocaleDateString()}</p></Section>}
      </div>

      <div className="fixed bottom-24 md:bottom-6 left-0 right-0 px-4 z-40 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={() => (applied || isOwner ? null : setShowApply(true))}
            disabled={applied || !!isOwner}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg disabled:opacity-60"
          >
            {isOwner ? "Your job" : applied ? "Applied ✓" : "Apply Now"}
          </button>
        </div>
      </div>

      {showApply && (
        <div className="fixed inset-0 z-[70] bg-black/60 md:flex md:items-center md:justify-center overflow-y-auto">
          <div className="bg-background w-full md:max-w-2xl md:rounded-2xl md:my-8 min-h-screen md:min-h-0 flex flex-col">
            <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4 py-3 z-10">
              <button onClick={() => setShowApply(false)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold">Apply to {job.title}</h2>
              <div className="w-9" />
            </div>

            <div className="flex-1 p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Full name *">
                  <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Email *">
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Years of experience">
                  <input inputMode="numeric" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Portfolio / Website">
                  <input placeholder="https://" value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} className={inputCls} />
                </Field>
                <Field label="LinkedIn">
                  <input placeholder="https://linkedin.com/in/…" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Expected salary ($/yr)">
                  <input inputMode="numeric" value={form.expected_salary} onChange={(e) => set("expected_salary", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Availability">
                  <input placeholder="Immediate, 2 weeks…" value={form.availability} onChange={(e) => set("availability", e.target.value)} className={inputCls} />
                </Field>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.work_authorized} onChange={(e) => set("work_authorized", e.target.checked)} />
                  Authorized to work
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.willing_to_relocate} onChange={(e) => set("willing_to_relocate", e.target.checked)} />
                  Willing to relocate
                </label>
              </div>

              <Field label="Résumé">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-muted border border-border text-xs font-semibold cursor-pointer">
                    {uploadingResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {form.resume_url ? "Replace file" : "Upload PDF"}
                    <input type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                  </label>
                  {form.resume_url && (
                    <a href={form.resume_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate">Preview</a>
                  )}
                  <button type="button" onClick={() => nav("/resume-builder")} className="text-xs text-primary font-semibold">
                    Or build with AI →
                  </button>
                </div>
              </Field>

              <Field label="Cover letter">
                <textarea
                  value={form.cover_letter}
                  onChange={(e) => set("cover_letter", e.target.value)}
                  rows={6}
                  placeholder="Why you're a great fit…"
                  className="w-full rounded-xl bg-muted border border-border p-3 text-sm outline-none"
                />
                <button
                  onClick={genCoverLetter}
                  disabled={aiGen}
                  className="mt-2 w-full h-10 rounded-full bg-gradient-to-r from-fuchsia-500/15 to-cyan-500/15 border border-primary/30 text-primary font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {aiGen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiGen ? "Drafting…" : form.cover_letter ? "Rewrite with YAJ Buddy" : "Write with YAJ Buddy"}
                </button>
              </Field>
            </div>

            <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
              <button
                onClick={submitApplication}
                disabled={submitting}
                className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{title}</h2>
      {children}
    </div>
  );
}
