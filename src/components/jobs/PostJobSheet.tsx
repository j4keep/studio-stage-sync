import { useEffect, useState } from "react";
import { Building2, Plus, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  JOB_CATEGORIES,
  EMPLOYMENT_TYPES,
  REMOTE_MODES,
  EXPERIENCE_LEVELS,
  QUALIFICATION_OPTIONS,
  normalizeExternalApplyUrl,
  parseMoney,
} from "@/lib/jobs";

export type EditableJob = {
  id: string;
  title: string;
  description: string;
  category: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_mode: string | null;
  skills: string[] | null;
  education: string | null;
  experience_level: string | null;
  benefits: string[] | null;
  deadline: string | null;
  qualifications: string[] | null;
  external_apply_url: string | null;
  cover_image_url?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When set, sheet edits this listing instead of creating. */
  editJob?: EditableJob | null;
};

const emptyForm = {
  title: "",
  description: "",
  category: "corporate",
  employment_type: "full_time",
  salary_min: "",
  salary_max: "",
  location: "",
  remote_mode: "onsite",
  skills: "",
  education: "",
  experience_level: "mid",
  benefits: "",
  deadline: "",
  external_apply_url: "",
};

export default function PostJobSheet({ open, onClose, onCreated, editJob }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [customQual, setCustomQual] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [companyName, setCompanyName] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [companyProfileId, setCompanyProfileId] = useState<string | null>(null);
  const isEdit = !!editJob;

  useEffect(() => {
    if (!open) return;
    if (editJob) {
      setForm({
        title: editJob.title || "",
        description: editJob.description || "",
        category: editJob.category || "corporate",
        employment_type: editJob.employment_type || "full_time",
        salary_min: editJob.salary_min != null ? String(editJob.salary_min) : "",
        salary_max: editJob.salary_max != null ? String(editJob.salary_max) : "",
        location: editJob.location || "",
        remote_mode: editJob.remote_mode || "onsite",
        skills: (editJob.skills ?? []).join(", "),
        education: editJob.education || "",
        experience_level: editJob.experience_level || "mid",
        benefits: (editJob.benefits ?? []).join(", "),
        deadline: editJob.deadline ? editJob.deadline.slice(0, 10) : "",
        external_apply_url: editJob.external_apply_url || "",
      });
      setQualifications(editJob.qualifications ?? []);
      setCustomQual("");
      setPostImageUrl(editJob.cover_image_url || "");
    } else {
      setForm(emptyForm);
      setQualifications([]);
      setCustomQual("");
      setPostImageUrl(""); // each new post starts with no image — pick per listing
    }

    if (!user) return;
    (async () => {
      const { data: emp } = await supabase
        .from("employer_profiles")
        .select("id,company_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (emp) {
        setCompanyProfileId(emp.id);
        setCompanyName(emp.company_name || "");
      } else {
        setCompanyProfileId(null);
        setCompanyName("");
      }
    })();
  }, [open, editJob, user]);

  if (!open) return null;

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addQualification = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setQualifications((prev) => (prev.includes(q) ? prev : [...prev, q]));
  };

  const removeQualification = (q: string) =>
    setQualifications((prev) => prev.filter((x) => x !== q));

  const addCustomQualification = () => {
    if (!customQual.trim()) return;
    addQualification(customQual);
    setCustomQual("");
  };

  const uploadPostImage = async (file: File) => {
    if (!user) return;
    setUploadingLogo(true);
    const path = `job-covers/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      setUploadingLogo(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    setPostImageUrl(pub.publicUrl);
    setUploadingLogo(false);
    toast.success("Post image uploaded — only for this job");
  };

  const saveCompanyProfile = async () => {
    if (!user) return false;
    const name = companyName.trim();
    if (!name) {
      toast.error("Company name is required so applicants know who they’re applying to");
      return false;
    }
    // Name only — do not overwrite a shared logo; images are per job post
    const payload = {
      user_id: user.id,
      company_name: name,
    };
    if (companyProfileId) {
      const { error } = await supabase.from("employer_profiles").update(payload).eq("id", companyProfileId);
      if (error) {
        toast.error(error.message);
        return false;
      }
    } else {
      const { data, error } = await supabase.from("employer_profiles").insert(payload).select("id").single();
      if (error) {
        toast.error(error.message);
        return false;
      }
      if (data?.id) setCompanyProfileId(data.id);
    }
    return true;
  };

  const buildPayload = () => {
    const externalUrlRaw = form.external_apply_url.trim();
    let external_apply_url: string | null = null;
    if (externalUrlRaw) {
      external_apply_url = normalizeExternalApplyUrl(externalUrlRaw);
      if (!external_apply_url) return null;
    }
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      employment_type: form.employment_type,
      salary_min: parseMoney(form.salary_min),
      salary_max: parseMoney(form.salary_max),
      location: form.location.trim() || null,
      remote_mode: form.remote_mode,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      education: form.education.trim() || null,
      experience_level: form.experience_level,
      benefits: form.benefits.split(",").map((s) => s.trim()).filter(Boolean),
      deadline: form.deadline || null,
      qualifications,
      external_apply_url,
      cover_image_url: postImageUrl || null,
    };
  };

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    const payload = buildPayload();
    if (payload === null) {
      toast.error("Enter a full website like https://company.com/careers");
      return;
    }

    setSaving(true);
    const companyOk = await saveCompanyProfile();
    if (!companyOk) {
      setSaving(false);
      return;
    }

    const { error } = isEdit
      ? await supabase.from("job_listings").update(payload).eq("id", editJob!.id).eq("employer_id", user.id)
      : await supabase.from("job_listings").insert({ ...payload, employer_id: user.id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Job updated!" : "Job posted!");
    onCreated?.();
    onClose();
  };

  const unusedOptions = QUALIFICATION_OPTIONS.filter((q) => !qualifications.includes(q));

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col md:items-center md:justify-center md:bg-black/60">
      <div className="w-full h-full md:h-[92vh] md:max-w-2xl md:rounded-2xl md:overflow-hidden bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold">{isEdit ? "Edit Job" : "Post a Job"}</h2>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
          >
            {saving ? (isEdit ? "Saving…" : "Posting…") : isEdit ? "Save" : "Publish"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold">Your company *</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Business name is saved to your employer profile. Post image is for this job only — pick a different one on each post if you want.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="h-24 bg-muted relative flex items-center justify-center">
                {postImageUrl ? (
                  <img src={postImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0 -mt-8 ring-2 ring-background relative z-[1]">
                  {postImageUrl ? (
                    <img src={postImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{companyName.trim() || "Company name"}</p>
                  <p className="text-[10px] text-muted-foreground">Preview for this job post</p>
                </div>
              </div>
            </div>

            <Field label="Company / business name *">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Studios"
                className={inputCls}
              />
            </Field>

            <div>
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Image for this job post (optional)</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-muted border border-border text-xs font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? "Uploading…" : postImageUrl ? "Replace image" : "Upload image for this post"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploadingLogo}
                    onChange={(e) => e.target.files?.[0] && uploadPostImage(e.target.files[0])}
                  />
                </label>
                {postImageUrl && (
                  <button
                    type="button"
                    onClick={() => setPostImageUrl("")}
                    className="text-[11px] font-semibold text-rose-500"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Only shows on this listing — other job posts keep their own images.
              </p>
            </div>
          </div>

          <Field label="Job Title *">
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Senior Product Designer"
              className={inputCls}
            />
          </Field>

          <Field label="Description *">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={5}
              placeholder="Role overview, responsibilities, must-haves…"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputCls}>
                {JOB_CATEGORIES.filter((c) => c.id !== "featured").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={form.employment_type}
                onChange={(e) => update("employment_type", e.target.value)}
                className={inputCls}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Compensation min ($/yr)">
              <input
                inputMode="decimal"
                value={form.salary_min}
                onChange={(e) => update("salary_min", e.target.value)}
                placeholder="e.g. 45000"
                className={inputCls}
              />
            </Field>
            <Field label="Compensation max ($/yr)">
              <input
                inputMode="decimal"
                value={form.salary_max}
                onChange={(e) => update("salary_max", e.target.value)}
                placeholder="e.g. 65000"
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Shown to applicants on the job and their application. Leave blank only if pay is truly TBD.
          </p>

          <Field label="Job address / location">
            <input
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Street, City, State, ZIP"
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Applicants see a map icon that opens this address in Google Maps.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Work mode">
              <select value={form.remote_mode} onChange={(e) => update("remote_mode", e.target.value)} className={inputCls}>
                {REMOTE_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Experience">
              <select
                value={form.experience_level}
                onChange={(e) => update("experience_level", e.target.value)}
                className={inputCls}
              >
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Required Skills (comma-separated)">
            <input
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
              placeholder="Figma, TypeScript, Design Systems"
              className={inputCls}
            />
          </Field>

          <Field label="Education">
            <input
              value={form.education}
              onChange={(e) => update("education", e.target.value)}
              placeholder="Bachelor's degree or equivalent"
              className={inputCls}
            />
          </Field>

          <Field label="Benefits (comma-separated)">
            <input
              value={form.benefits}
              onChange={(e) => update("benefits", e.target.value)}
              placeholder="Health, 401k, Remote-friendly"
              className={inputCls}
            />
          </Field>

          <Field label="Required Qualifications">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addQualification(e.target.value);
              }}
              className={inputCls}
            >
              <option value="">Select a qualification…</option>
              {unusedOptions.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>

            <div className="mt-2 flex gap-2">
              <input
                value={customQual}
                onChange={(e) => setCustomQual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomQualification();
                  }
                }}
                placeholder="Or type a custom qualification"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addCustomQualification}
                className="h-11 px-3 rounded-xl bg-muted border border-border text-xs font-bold shrink-0 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {qualifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {qualifications.map((q) => (
                  <span
                    key={q}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 h-8 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/25"
                  >
                    {q}
                    <button
                      type="button"
                      onClick={() => removeQualification(q)}
                      className="w-5 h-5 rounded-full hover:bg-primary/15 flex items-center justify-center"
                      aria-label={`Remove ${q}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Shown on the listing for applicants. They enter their own qualifications when applying.
            </p>
          </Field>

          <Field label="Apply on external website (optional)">
            <input
              value={form.external_apply_url}
              onChange={(e) => update("external_apply_url", e.target.value)}
              placeholder="https://company.com/careers/apply"
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use a full website link (include https://). If set, Apply opens your site instead of the YAJ form.
            </p>
          </Field>

          <Field label="Application Deadline">
            <input type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} className={inputCls} />
          </Field>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
