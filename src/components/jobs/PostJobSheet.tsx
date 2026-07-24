import { useState } from "react";
import { Plus, X } from "lucide-react";
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
} from "@/lib/jobs";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

export default function PostJobSheet({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [customQual, setCustomQual] = useState("");
  const [form, setForm] = useState({
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
  });

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

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    const externalUrlRaw = form.external_apply_url.trim();
    let external_apply_url: string | null = null;
    if (externalUrlRaw) {
      external_apply_url = normalizeExternalApplyUrl(externalUrlRaw);
      if (!external_apply_url) {
        toast.error("Enter a full website like https://company.com/careers");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("job_listings").insert({
      employer_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      employment_type: form.employment_type,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      location: form.location.trim() || null,
      remote_mode: form.remote_mode,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      education: form.education.trim() || null,
      experience_level: form.experience_level,
      benefits: form.benefits.split(",").map((s) => s.trim()).filter(Boolean),
      deadline: form.deadline || null,
      qualifications,
      external_apply_url,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Job posted!");
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
          <h2 className="text-sm font-bold">Post a Job</h2>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
          >
            {saving ? "Posting…" : "Publish"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
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
            <Field label="Salary Min ($/yr)">
              <input
                inputMode="numeric"
                value={form.salary_min}
                onChange={(e) => update("salary_min", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Salary Max ($/yr)">
              <input
                inputMode="numeric"
                value={form.salary_max}
                onChange={(e) => update("salary_max", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

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
              Applicants will see these as required qualifications for the role.
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
