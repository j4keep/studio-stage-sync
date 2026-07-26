import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  HIRE_CATEGORIES,
  PROJECT_TYPES,
  WORK_FOCUS,
  defaultServiceMap,
} from "@/lib/hire-pro";
import { upsertProProfile, type ProProfile } from "@/lib/pro-profiles";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  existing?: ProProfile | null;
};

export default function EditProProfileSheet({ open, onClose, onSaved, existing }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [about, setAbout] = useState("");
  const [hourly, setHourly] = useState("");
  const [area, setArea] = useState("");
  const [categories, setCategories] = useState<string[]>(["handyman"]);
  const [projectTypes, setProjectTypes] = useState(defaultServiceMap(PROJECT_TYPES, true));
  const [workFocus, setWorkFocus] = useState(defaultServiceMap(WORK_FOCUS, true));
  const [responds, setResponds] = useState("60");

  useEffect(() => {
    if (!open) return;
    setBusinessName(existing?.business_name || existing?.display_name || "");
    setAbout(existing?.about || existing?.gig_experience_bio || "");
    setHourly(existing?.hourly_rate != null ? String(existing.hourly_rate) : "60");
    setArea(existing?.service_area || "");
    setCategories(existing?.categories?.length ? existing.categories : ["handyman"]);
    setProjectTypes(existing?.project_types || defaultServiceMap(PROJECT_TYPES, true));
    setWorkFocus(existing?.work_focus || defaultServiceMap(WORK_FOCUS, true));
    setResponds(String(existing?.responds_minutes ?? 60));
  }, [open, existing]);

  if (!open) return null;

  const toggleCat = (id: string) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!user) return toast.error("Sign in first");
    if (!categories.length) return toast.error("Pick at least one category");
    setSaving(true);
    try {
      await upsertProProfile(user.id, {
        business_name: businessName.trim() || null,
        about: about.trim() || null,
        hourly_rate: hourly ? Number(hourly) : null,
        service_area: area.trim() || null,
        categories,
        project_types: projectTypes,
        work_focus: workFocus,
        responds_minutes: Number(responds) || 60,
        is_active: true,
        media: existing?.media || [],
        skills: existing?.skills || [],
      } as any);
      toast.success("Pro profile saved — you're visible on Hire a Pro");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Offer your services</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Set up your Nextdoor-style pro page so hosts can find you under Hire a Pro.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Business / display name</span>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">About / experience</span>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm" placeholder="Skills, tools, past jobs…" />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Hourly rate ($)</span>
            <input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Responds (min)</span>
            <input value={responds} onChange={(e) => setResponds(e.target.value)} inputMode="numeric" className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
          </label>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Service area</span>
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Hollywood, FL" className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
        </label>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Categories</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {HIRE_CATEGORIES.map((c) => {
            const on = categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${on ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <ToggleMap title="Project type" options={PROJECT_TYPES} value={projectTypes} onChange={setProjectTypes} />
        <ToggleMap title="Work focus" options={WORK_FOCUS} value={workFocus} onChange={setWorkFocus} />

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-2 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Publish pro profile"}
        </button>
      </div>
    </div>
  );
}

function ToggleMap({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: string; label: string }[];
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {options.map((o) => {
          const on = value[o.id] !== false;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange({ ...value, [o.id]: !on })}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ${on ? "text-foreground" : "text-muted-foreground line-through"}`}
            >
              {o.label}
              <span className="text-[10px] font-bold uppercase">{on ? "Offers" : "No"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
