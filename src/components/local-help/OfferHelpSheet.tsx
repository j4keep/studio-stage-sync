import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  LOCAL_HELP_CATEGORIES,
  PROJECT_TYPES,
  WORK_FOCUS,
  defaultServiceMap,
} from "@/lib/local-help";
import { getLocalHelpPro, upsertLocalHelpPro } from "@/lib/pro-profiles";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function OfferHelpSheet({ open, onClose }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [about, setAbout] = useState("");
  const [hourly, setHourly] = useState("");
  const [area, setArea] = useState("");
  const [categories, setCategories] = useState<string[]>(["handyman"]);
  const [projectTypes, setProjectTypes] = useState(defaultServiceMap(PROJECT_TYPES, true));
  const [workFocus, setWorkFocus] = useState(defaultServiceMap(WORK_FOCUS, true));

  useEffect(() => {
    if (!open || !user) return;
    void (async () => {
      setLoading(true);
      try {
        const existing = await getLocalHelpPro(user.id);
        if (existing) {
          setBusinessName(existing.business_name || existing.display_name || "");
          setAbout(existing.about || "");
          setHourly(existing.hourly_rate != null ? String(existing.hourly_rate) : "");
          setArea(existing.service_area || "");
          setCategories(existing.categories?.length ? existing.categories : ["handyman"]);
          setProjectTypes(existing.project_types);
          setWorkFocus(existing.work_focus);
        }
      } catch {
        /* new helper */
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user]);

  if (!open) return null;

  const toggleCat = (id: string) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!user) return toast.error("Sign in to offer help");
    if (!categories.length) return toast.error("Pick at least one category");
    setSaving(true);
    try {
      await upsertLocalHelpPro(user.id, {
        business_name: businessName.trim() || null,
        about: about.trim() || null,
        hourly_rate: hourly ? Number(hourly) : null,
        service_area: area.trim() || null,
        categories,
        project_types: projectTypes,
        work_focus: workFocus,
        is_active: true,
        media: [],
        skills: [],
        responds_minutes: 45,
      });
      toast.success("You're listed in Find Local Help");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black">Offer local help</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Neighbors, freelancers, students & pros — list the help you can give.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <label className="mt-4 block text-[11px] font-bold text-muted-foreground">Display / business name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              placeholder="e.g. Maya's Handyman Help"
            />

            <label className="mt-3 block text-[11px] font-bold text-muted-foreground">About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-muted p-3 text-sm"
              placeholder="What you're great at…"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground">Hourly rate ($)</label>
                <input
                  value={hourly}
                  onChange={(e) => setHourly(e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground">Service area</label>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                  placeholder="City / zip"
                />
              </div>
            </div>

            <p className="mt-4 text-[11px] font-bold text-muted-foreground">Categories</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LOCAL_HELP_CATEGORIES.map((c) => {
                const on = categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                      on ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] font-bold text-muted-foreground">Project types you offer</p>
            <div className="mt-2 space-y-1">
              {PROJECT_TYPES.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={projectTypes[o.id] !== false}
                    onChange={(e) => setProjectTypes((p) => ({ ...p, [o.id]: e.target.checked }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-bold text-muted-foreground">Work focus</p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {WORK_FOCUS.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={workFocus[o.id] !== false}
                    onChange={(e) => setWorkFocus((p) => ({ ...p, [o.id]: e.target.checked }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Go live in Find Local Help
            </button>
          </>
        )}
      </div>
    </div>
  );
}
