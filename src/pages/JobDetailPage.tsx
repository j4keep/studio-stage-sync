import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Bookmark, BookmarkCheck, Building2, Sparkles, Loader2, X, Upload, Plus, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatSalary, timeAgo, EMPLOYMENT_TYPES, REMOTE_MODES, SHIFT_OPTIONS } from "@/lib/jobs";
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
  qualifications: string[] | null;
  external_apply_url: string | null;
};

type EmploymentEntry = { employer: string; supervisor: string; phone: string; title: string; start: string; end: string; pay: string; reason: string };
type EducationEntry = { school: string; degree: string; year: string };
type ReferenceEntry = { name: string; relationship: string; phone: string; email: string };

const emptyEmployment = (): EmploymentEntry => ({ employer: "", supervisor: "", phone: "", title: "", start: "", end: "", pay: "", reason: "" });
const emptyEducation = (): EducationEntry => ({ school: "", degree: "", year: "" });
const emptyReference = (): ReferenceEntry => ({ name: "", relationship: "", phone: "", email: "" });

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
  const [resumeSnapshot, setResumeSnapshot] = useState<any>(null);

  // Application form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workAuthorized, setWorkAuthorized] = useState(true);
  const [willingRelocate, setWillingRelocate] = useState(false);
  const [yearsExp, setYearsExp] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [availability, setAvailability] = useState("");
  const [desiredPosition, setDesiredPosition] = useState("");
  const [targetPay, setTargetPay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [shiftPref, setShiftPref] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [certsText, setCertsText] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [confirmedQuals, setConfirmedQuals] = useState<string[]>([]);
  const [employment, setEmployment] = useState<EmploymentEntry[]>([emptyEmployment()]);
  const [education, setEducation] = useState<EducationEntry[]>([emptyEducation()]);
  const [references, setReferences] = useState<ReferenceEntry[]>([emptyReference()]);

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
        setFullName(p?.display_name ?? "");
        setEmail(p?.email ?? user.email ?? "");
        setResumeUrl((r as any)?.file_url ?? "");
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

  const toggleQual = (q: string) =>
    setConfirmedQuals((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]));

  const submitApplication = async () => {
    if (!user || !job) return toast.error("Please sign in first");
    if (!fullName.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      return toast.error("Name, email, phone, and address are required");
    }
    setSubmitting(true);
    const { error } = await supabase.from("job_applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      status: "applied",
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      years_experience: yearsExp ? Number(yearsExp) : null,
      expected_salary: expectedSalary ? Number(expectedSalary) : null,
      availability: availability.trim() || null,
      work_authorized: workAuthorized,
      willing_to_relocate: willingRelocate,
      resume_url: resumeUrl || null,
      resume_snapshot: resumeSnapshot,
      cover_letter: coverLetter.trim() || null,
      desired_position: desiredPosition.trim() || job.title,
      target_pay_rate: targetPay.trim() || null,
      available_start_date: startDate || null,
      shift_preference: shiftPref || null,
      application_skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
      certifications: [...confirmedQuals, ...certsText.split(",").map((s) => s.trim()).filter(Boolean)],
      employment_history: employment.filter((e) => e.employer.trim()) as any,
      education_history: education.filter((e) => e.school.trim()) as any,
      references_json: references.filter((r) => r.name.trim()) as any,
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

  const handleApplyClick = () => {
    if (applied || isOwner) return;
    if (hasExternal) {
      window.open(job.external_apply_url!, "_blank", "noopener,noreferrer");
      return;
    }
    setShowApply(true);
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
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={handleApplyClick}
            disabled={applied || !!isOwner}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {isOwner
              ? "Your job"
              : applied
              ? "Applied ✓"
              : hasExternal
              ? <>Apply on Company Site <ExternalLink className="w-4 h-4" /></>
              : "Apply Now"}
          </button>
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

              {/* Qualifications confirmation */}
              {job.qualifications && job.qualifications.length > 0 && (
                <FormGroup title="Confirm Qualifications" subtitle="Check the ones you meet.">
                  <div className="flex flex-wrap gap-2">
                    {job.qualifications.map((q) => {
                      const on = confirmedQuals.includes(q);
                      return (
                        <button
                          type="button"
                          key={q}
                          onClick={() => toggleQual(q)}
                          className={`px-3 h-8 rounded-full border text-[11px] font-semibold transition ${
                            on
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted border-border text-foreground/80"
                          }`}
                        >
                          {on ? "✓ " : ""}{q}
                        </button>
                      );
                    })}
                  </div>
                </FormGroup>
              )}

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
                  <Field label="Licenses / Certifications (comma-separated)">
                    <input value={certsText} onChange={(e) => setCertsText(e.target.value)} placeholder="e.g. Driver's License, CPR, OSHA-10" className={inputCls} />
                  </Field>
                </div>
              </FormGroup>

              {/* Availability */}
              <FormGroup title="Availability & Preferences">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Desired position">
                    <input value={desiredPosition} onChange={(e) => setDesiredPosition(e.target.value)} placeholder={job.title} className={inputCls} />
                  </Field>
                  <Field label="Target pay rate">
                    <input value={targetPay} onChange={(e) => setTargetPay(e.target.value)} placeholder="$/hr or $/yr" className={inputCls} />
                  </Field>
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
                  <Field label="Expected salary ($/yr)">
                    <input inputMode="numeric" value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} className={inputCls} />
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

              {/* References */}
              <FormGroup title="References">
                {references.map((row, i) => (
                  <div key={i} className="rounded-xl border border-border p-3 mb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Reference #{i + 1}</span>
                      {references.length > 1 && (
                        <button onClick={() => setReferences(references.filter((_, idx) => idx !== i))} className="text-muted-foreground">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input placeholder="Name" value={row.name} onChange={(e) => setReferences(references.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Relationship" value={row.relationship} onChange={(e) => setReferences(references.map((r, idx) => idx === i ? { ...r, relationship: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Phone" value={row.phone} onChange={(e) => setReferences(references.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r))} className={inputCls} />
                      <input placeholder="Email" value={row.email} onChange={(e) => setReferences(references.map((r, idx) => idx === i ? { ...r, email: e.target.value } : r))} className={inputCls} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setReferences([...references, emptyReference()])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Plus className="w-3.5 h-3.5" /> Add another reference
                </button>
              </FormGroup>

              {/* Résumé + Cover letter */}
              <FormGroup title="Résumé & Cover Letter">
                <Field label="Résumé (optional)">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-muted border border-border text-xs font-semibold cursor-pointer">
                      {uploadingResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {resumeUrl ? "Replace file" : "Upload PDF"}
                      <input type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                    </label>
                    {resumeUrl && (
                      <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate">Preview</a>
                    )}
                    <button type="button" onClick={() => nav("/resume-builder")} className="text-xs text-primary font-semibold">
                      Or build with AI →
                    </button>
                  </div>
                </Field>

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
              </FormGroup>
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
