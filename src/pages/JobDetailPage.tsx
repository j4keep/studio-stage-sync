import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Bookmark, BookmarkCheck, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatSalary, timeAgo, EMPLOYMENT_TYPES, REMOTE_MODES } from "@/lib/jobs";

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

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("job_listings").select("*").eq("id", id).maybeSingle();
      setJob(data as Job | null);
      setLoading(false);
      if (user && data) {
        const { data: s } = await supabase.from("saved_jobs").select("id").eq("user_id", user.id).eq("job_id", id).maybeSingle();
        setSaved(!!s);
        const { data: a } = await supabase.from("job_applications").select("id").eq("applicant_id", user.id).eq("job_id", id).maybeSingle();
        setApplied(!!a);
      }
    })();
  }, [id, user]);

  const toggleSave = async () => {
    if (!user || !job) return;
    if (saved) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", job.id);
      setSaved(false);
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: job.id });
      setSaved(true);
    }
  };

  const apply = async () => {
    if (!user || !job) {
      toast.error("Please sign in first");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("job_applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      cover_letter: coverLetter.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplied(true);
    setShowApply(false);
    toast.success("Application sent!");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!job) return <div className="p-6 text-sm">Job not found.</div>;

  const empType = EMPLOYMENT_TYPES.find((t) => t.id === job.employment_type)?.label ?? job.employment_type;
  const mode = REMOTE_MODES.find((m) => m.id === job.remote_mode)?.label ?? job.remote_mode;

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

      <div className="p-4 space-y-4 pb-32">
        <div>
          <h1 className="text-xl font-black tracking-tight">{job.title}</h1>
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

      <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => (applied ? null : setShowApply(true))}
            disabled={applied || (user && job.employer_id === user.id)}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg disabled:opacity-60"
          >
            {user && job.employer_id === user.id ? "Your job" : applied ? "Applied ✓" : "Apply Now"}
          </button>
        </div>
      </div>

      {showApply && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowApply(false)}>
          <div className="w-full max-w-md bg-background rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Apply to {job.title}</h3>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={5}
              placeholder="Optional cover letter — why you're a great fit"
              className="w-full rounded-xl bg-muted border border-border p-3 text-sm outline-none"
            />
            <button
              onClick={apply}
              disabled={submitting}
              className="mt-3 w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send Application"}
            </button>
          </div>
        </div>
      )}
    </div>
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
