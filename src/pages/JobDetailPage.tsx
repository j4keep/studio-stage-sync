import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Bookmark, BookmarkCheck, Building2, Sparkles, Loader2, X, Upload, Plus, Trash2, ExternalLink, CheckCircle2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatSalary, timeAgo, EMPLOYMENT_TYPES, REMOTE_MODES, SHIFT_OPTIONS, googleMapsUrl, normalizeExternalApplyUrl, resolveJobCover } from "@/lib/jobs";
import MessageUserButton from "@/components/MessageUserButton";

import { generateCoverLetter } from "@/lib/yaj-jobs-ai";
import ResumePreview from "@/components/jobs/ResumePreview";

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
  qualifications: string[] | null;
  external_apply_url: string | null;
  cover_image_url?: string | null;
  media?: unknown;
};

type EmploymentEntry = { employer: string; supervisor: string; phone: string; title: string; start: string; end: string; pay: string; reason: string };
type EducationEntry = { school: string; degree: string; year: string };

const emptyEmployment = (): EmploymentEntry => ({ employer: "", supervisor: "", phone: "", title: "", start: "", end: "", pay: "", reason: "" });
const emptyEducation = (): EducationEntry => ({ school: "", degree: "", year: "" });

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiGen, setAiGen] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeSnapshot, setResumeSnapshot] = useState<any>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [attachAiResume, setAttachAiResume] = useState(false);
  const [hasSavedAiResume, setHasSavedAiResume] = useState(false);

  // Application form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workAuthorized, setWorkAuthorized] = useState(true);
  const [willingRelocate, setWillingRelocate] = useState(false);
  const [yearsExp, setYearsExp] = useState("");
  const [availability, setAvailability] = useState("");
  const [startDate, setStartDate] = useState("");
  const [shiftPref, setShiftPref] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [certsText, setCertsText] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [employment, setEmployment] = useState<EmploymentEntry[]>([emptyEmployment()]);
  const [education, setEducation] = useState<EducationEntry[]>([emptyEducation()]);
  const [employerBrand, setEmployerBrand] = useState<{ company_name: string } | null>(null);

  const loadSavedResume = async (uid: string) => {
    // Prefer default, then any résumé with structured AI data
    const { data: preferred } = await supabase
      .from("resumes")
      .select("id,structured_data,file_url,source,is_default")
      .eq("user_id", uid)
      .eq("is_default", true)
      .maybeSingle();

    let r = preferred;
    if (!r) {
      const { data: anyResume } = await supabase
        .from("resumes")
        .select("id,structured_data,file_url,source,is_default")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      r = anyResume;
    }

    if (!r) {
      setHasSavedAiResume(false);
      setResumeId(null);
      setResumeSnapshot(null);
      return null;
    }

    const structured = (r as any).structured_data;
    setHasSavedAiResume(true);
    setResumeId(r.id);
    setResumeSnapshot(structured ?? null);
    if ((r as any).file_url) setResumeUrl((r as any).file_url);
    return r;
  };

  const openApply = async () => {
    if (user) {
      const r = await loadSavedResume(user.id);
      if (r) setAttachAiResume(true);
    }
    setShowApply(true);
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("job_listings").select("*").eq("id", id).maybeSingle();
      setJob(data as Job | null);
      setLoading(false);
      if (data?.employer_id) {
        const { data: emp } = await supabase
          .from("employer_profiles")
          .select("company_name")
          .eq("user_id", data.employer_id)
          .maybeSingle();
        if (emp) setEmployerBrand({ company_name: emp.company_name });
      }
      if (user && data) {
        const [{ data: s }, { data: a }, { data: p }] = await Promise.all([
          supabase.from("saved_jobs").select("id").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
          supabase.from("job_applications").select("id").eq("applicant_id", user.id).eq("job_id", id).maybeSingle(),
          supabase.from("profiles").select("display_name,email").eq("user_id", user.id).maybeSingle(),
        ]);
        setSaved(!!s);
        setApplied(!!a);
        setFullName(p?.display_name ?? "");
        setEmail(p?.email ?? user.email ?? "");
        const r = await loadSavedResume(user.id);
        if (r && (r as any).structured_data) setAttachAiResume(true);
      }
    })();
  }, [id, user]);

  // Return from resume builder → open apply with AI resume attached
  useEffect(() => {
    if (!job || applied) return;
    if (searchParams.get("apply") !== "1") return;
    (async () => {
      if (user) await loadSavedResume(user.id);
      setAttachAiResume(true);
      setShowApply(true);
      const next = new URLSearchParams(searchParams);
      next.delete("apply");
      setSearchParams(next, { replace: true });
      toast.success("YAJ AI résumé ready to attach");
    })();
  }, [job, applied, searchParams, user]);

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
    setResumeUrl(pub.publicUrl);
    setUploadingResume(false);
    toast.success("Résumé uploaded");
  };

  const genCoverLetter = async () => {
    if (!user || !job) return;
    setAiGen(true);
    try {
      const letter = await generateCoverLetter(
        { title: job.title, description: job.description, skills: job.skills, location: job.location },
        resumeSnapshot ?? { profile: { display_name: fullName } },
        coverLetter,
      );
      setCoverLetter(letter);
      toast.success("Cover letter drafted");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate cover letter");
    } finally {
      setAiGen(false);
    }
  };

  const submitApplication = async () => {
    if (!user || !job) return toast.error("Please sign in first");
    if (!fullName.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      return toast.error("Name, email, phone, and address are required");
    }
    setSubmitting(true);
    const { error } = await supabase.from("job_applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      status: "reviewing",
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      years_experience: yearsExp ? Number(yearsExp) : null,
      expected_salary: null,
      availability: availability.trim() || null,
      work_authorized: workAuthorized,
      willing_to_relocate: willingRelocate,
      resume_id: attachAiResume && hasSavedAiResume && resumeId ? resumeId : null,
      resume_url: resumeUrl || null,
      resume_snapshot: attachAiResume && hasSavedAiResume ? resumeSnapshot : null,
      cover_letter: coverLetter.trim() || null,
      desired_position: job.title,
      target_pay_rate: null,
      available_start_date: startDate || null,
      shift_preference: shiftPref || null,
      application_skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
      certifications: certsText.split(",").map((s) => s.trim()).filter(Boolean),
      employment_history: employment.filter((e) => e.employer.trim()) as any,
      education_history: education.filter((e) => e.school.trim()) as any,
      references_json: [],
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
  const hasExternal = !!job.external_apply_url;
  const jobCover = resolveJobCover(job);

  const handleApplyClick = () => {
    if (applied || isOwner) return;
    if (hasExternal) {
      const url = normalizeExternalApplyUrl(job.external_apply_url || "");
      if (!url) {
        toast.error("This job’s external apply link is invalid. Try Apply on YAJ instead.");
        void openApply();
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    void openApply();
  };

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
        {(jobCover || employerBrand?.company_name) && (
          <div className="space-y-3">
            {jobCover && (
              <div className="w-full h-36 md:h-48 rounded-2xl overflow-hidden border border-border bg-muted">
                <img src={jobCover} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {employerBrand?.company_name && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {jobCover ? (
                    <img src={jobCover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{employerBrand.company_name}</p>
                  <p className="text-[11px] text-muted-foreground">Hiring on YAJ</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <h1 className="text-xl md:text-3xl font-black tracking-tight">{job.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{job.location}</span>
                <a
                  href={googleMapsUrl(job.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary"
                  aria-label="Open job location in Google Maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin className="w-3.5 h-3.5" />
                </a>
              </span>
            )}
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

        {job.qualifications && job.qualifications.length > 0 && (
          <Section title="Required Qualifications">
            <ul className="space-y-1.5">
              {job.qualifications.map((q) => (
                <li key={q} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {q}
                </li>
              ))}
            </ul>
          </Section>
        )}

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
        <div className="max-w-lg mx-auto pointer-events-auto flex gap-2">
          <button
            onClick={handleApplyClick}
            disabled={applied || !!isOwner}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {isOwner
              ? "Your job"
              : applied
              ? "Applied ✓"
              : hasExternal
              ? <>Apply on Company Site <ExternalLink className="w-4 h-4" /></>
              : "Apply Now"}
          </button>
          <MessageUserButton
            userId={job.employer_id}
            label="Message"
            className="h-12 px-4 rounded-2xl bg-card border border-border text-foreground font-bold text-sm shadow-lg inline-flex items-center justify-center gap-1.5"
          />
        </div>

      </div>

      {showApply && (
        <div className="fixed inset-0 z-[70] bg-black/60 md:flex md:items-center md:justify-center overflow-y-auto">
          <div className="bg-background w-full md:max-w-3xl md:rounded-2xl md:my-8 min-h-screen md:min-h-0 flex flex-col">
            <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4 py-3 z-10">
              <button onClick={() => setShowApply(false)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold truncate px-2">Apply to {job.title}</h2>
              <div className="w-9" />
            </div>

            <div className="flex-1 p-4 md:p-6 space-y-6">
              {/* Job being applied for — description + location from employer post */}
              <FormGroup title="Job you're applying for">
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                  {employerBrand?.company_name && (
                    <div className="flex items-center gap-2.5 pb-1">
                      {jobCover ? (
                        <img src={jobCover} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-sm font-bold truncate">{employerBrand.company_name}</p>
                    </div>
                  )}
                  <p className="text-sm font-bold">{job.title}</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{job.description}</p>
                  {job.location && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </span>
                      <a
                        href={googleMapsUrl(job.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Open in Maps
                      </a>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">{empType}</span>
                    <span className="px-2 py-1 rounded-full bg-muted font-semibold">{formatSalary(job.salary_min, job.salary_max)}</span>
                    <span className="px-2 py-1 rounded-full bg-muted font-semibold">{mode}</span>
                  </div>
                </div>
              </FormGroup>

              {/* Personal & contact */}
              <FormGroup title="Personal & Contact Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Full legal name *"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} /></Field>
                  <Field label="Email *"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
                  <Field label="Phone number *"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
                  <Field label="Current home address *"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State, ZIP" className={inputCls} /></Field>
                </div>
                <label className="inline-flex items-center gap-2 text-sm mt-3">
                  <input type="checkbox" checked={workAuthorized} onChange={(e) => setWorkAuthorized(e.target.checked)} />
                  Legally authorized to work in the country
                </label>
              </FormGroup>

              {/* Employment history */}
              <FormGroup title="Employment History">
                {employment.map((row, i) => (
                  <div key={i} className="rounded-xl border border-border p-3 mb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Job #{i + 1}</span>
                      {employment.length > 1 && (
                        <button onClick={() => setEmployment(employment.filter((_, idx) => idx !== i))} className="text-muted-foreground">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input placeholder="Employer name & address" value={row.employer} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, employer: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Supervisor name" value={row.supervisor} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, supervisor: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Phone" value={row.phone} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Your title" value={row.title} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Start date" value={row.start} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, start: e.target.value } : r))} className={inputCls} />
                      <input placeholder="End date (or Present)" value={row.end} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, end: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Starting / ending pay" value={row.pay} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, pay: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Reason for leaving" value={row.reason} onChange={(e) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, reason: e.target.value } : r))} className={inputCls} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setEmployment([...employment, emptyEmployment()])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Plus className="w-3.5 h-3.5" /> Add another job
                </button>
              </FormGroup>

              {/* Education & skills */}
              <FormGroup title="Education & Skills">
                {education.map((row, i) => (
                  <div key={i} className="rounded-xl border border-border p-3 mb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">School #{i + 1}</span>
                      {education.length > 1 && (
                        <button onClick={() => setEducation(education.filter((_, idx) => idx !== i))} className="text-muted-foreground">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input placeholder="School / college / trade" value={row.school} onChange={(e) => setEducation(education.map((r, idx) => idx === i ? { ...r, school: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Degree / diploma / certificate" value={row.degree} onChange={(e) => setEducation(education.map((r, idx) => idx === i ? { ...r, degree: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Year completed" value={row.year} onChange={(e) => setEducation(education.map((r, idx) => idx === i ? { ...r, year: e.target.value } : r))} className={inputCls} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setEducation([...education, emptyEducation()])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Plus className="w-3.5 h-3.5" /> Add another school
                </button>
                <div className="mt-3 space-y-3">
                  <Field label="Special skills (comma-separated)">
                    <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="e.g. Forklift, Excel, Spanish" className={inputCls} />
                  </Field>
                  <Field label="Your qualifications & certifications (comma-separated)">
                    <input value={certsText} onChange={(e) => setCertsText(e.target.value)} placeholder="e.g. Driver's License, CPR, OSHA-10, Forklift" className={inputCls} />
                  </Field>
                </div>
              </FormGroup>

              {/* Availability */}
              <FormGroup title="Availability">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Available start date">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Shift preference">
                    <select value={shiftPref} onChange={(e) => setShiftPref(e.target.value)} className={inputCls}>
                      <option value="">Select…</option>
                      {SHIFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Years of experience">
                    <input inputMode="numeric" value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Notice / availability">
                    <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Immediate, 2 weeks…" className={inputCls} />
                  </Field>
                </div>
                <label className="inline-flex items-center gap-2 text-sm mt-3">
                  <input type="checkbox" checked={willingRelocate} onChange={(e) => setWillingRelocate(e.target.checked)} />
                  Willing to relocate
                </label>
              </FormGroup>

              {/* Cover letter + optional file upload */}
              <FormGroup title="Cover Letter">
                <Field label="Cover letter (optional)">
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
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
                    {aiGen ? "Drafting…" : coverLetter ? "Rewrite with YAJ Buddy" : "Write with YAJ Buddy"}
                  </button>
                </Field>

                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground mb-1 block">Or upload a résumé file (optional)</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-muted border border-border text-xs font-semibold cursor-pointer">
                      {uploadingResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {resumeUrl ? "Replace PDF / file" : "Upload PDF / file"}
                      <input type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                    </label>
                    {resumeUrl && (
                      <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate">Preview file</a>
                    )}
                  </div>
                </div>
              </FormGroup>
            </div>

            <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 space-y-3">
              <label
                className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 cursor-pointer transition-colors ${
                  attachAiResume && hasSavedAiResume
                    ? "border-primary bg-primary/10"
                    : "border-primary/40 bg-primary/5"
                }`}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary shrink-0"
                  checked={attachAiResume && hasSavedAiResume}
                  disabled={!hasSavedAiResume}
                  onChange={(e) => {
                    if (!hasSavedAiResume) return;
                    setAttachAiResume(e.target.checked);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold inline-flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    Attach my YAJ AI résumé
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {hasSavedAiResume
                      ? "Check this so the employer can open and read your résumé with this application."
                      : "No saved YAJ AI résumé yet — build one, then come back and check this box."}
                  </p>
                  {!hasSavedAiResume && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nav(`/resume-builder?returnTo=${encodeURIComponent(`/jobs/${job.id}?apply=1`)}`);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Build with YAJ Buddy →
                    </button>
                  )}
                  {hasSavedAiResume && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nav(`/resume-builder?returnTo=${encodeURIComponent(`/jobs/${job.id}?apply=1`)}`);
                      }}
                      className="mt-1.5 text-[11px] font-semibold text-primary"
                    >
                      Edit résumé →
                    </button>
                  )}
                </div>
              </label>

              {attachAiResume && hasSavedAiResume && resumeSnapshot && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                  <ResumePreview data={resumeSnapshot} className="border-0 rounded-none" />
                </div>
              )}

              <button
                onClick={submitApplication}
                disabled={submitting}
                className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                {submitting ? "Sending…" : attachAiResume && hasSavedAiResume ? "Send Application + Résumé" : "Send Application"}
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

function FormGroup({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-base font-bold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
