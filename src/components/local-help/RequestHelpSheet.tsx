import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  HOURS_OPTIONS,
  PROJECT_TYPES,
  TIMELINE_OPTIONS,
  WORK_FOCUS,
  formatHourly,
} from "@/lib/local-help";
import { hireLocalHelper, type LocalHelpPro } from "@/lib/pro-profiles";

type Props = {
  open: boolean;
  onClose: () => void;
  pro: LocalHelpPro;
  categoryLabel?: string;
};

/** Capture project details → create gig (Jobs engine) + open chat. */
export default function RequestHelpSheet({ open, onClose, pro, categoryLabel }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [zip, setZip] = useState("");
  const [timeline, setTimeline] = useState("");
  const [hours, setHours] = useState("");
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [workFocus, setWorkFocus] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTimeline("");
    setHours("");
    setProjectTypes([]);
    setWorkFocus([]);
    setNotes("");
  }, [open]);

  const name = pro.business_name || pro.display_name || "Helper";
  const price = formatHourly(pro.hourly_rate);

  const title = useMemo(() => {
    const bits = [categoryLabel || "Local help", hours].filter(Boolean);
    return bits.join(" · ") || `Help from ${name}`;
  }, [categoryLabel, hours, name]);

  if (!open) return null;

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async () => {
    if (!user) return toast.error("Sign in to hire");
    if (!timeline || !hours) return toast.error("Pick timeline and estimated hours");
    setSaving(true);
    try {
      const description = [
        notes.trim() || `Requesting help via Find Local Help.`,
        zip ? `Zip: ${zip}` : null,
        `Timeline: ${timeline}`,
        `Estimated hours: ${hours}`,
        projectTypes.length
          ? `Project type: ${projectTypes.map((id) => PROJECT_TYPES.find((p) => p.id === id)?.label || id).join(", ")}`
          : null,
        workFocus.length
          ? `Work focus: ${workFocus.map((id) => WORK_FOCUS.find((p) => p.id === id)?.label || id).join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const cat = pro.categories[0] || "handyman";
      const gig = await hireLocalHelper({
        customerId: user.id,
        helperId: pro.user_id,
        title,
        description,
        category: cat,
      });

      toast.success("Request sent — chat opened");
      onClose();
      nav("/messages", {
        state: {
          startWithUserId: pro.user_id,
          startWithProfile: {
            user_id: pro.user_id,
            display_name: name,
            avatar_url: pro.avatar_url,
          },
          gigId: gig.id,
          gigTitle: gig.title,
        },
      });
    } catch (e: any) {
      toast.error(e?.message || "Could not create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-4 pb-10 shadow-xl sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              {pro.avatar_url ? (
                <img src={pro.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-bold text-primary">{name[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{name}</p>
              <p className="text-[11px] text-muted-foreground">
                ★ {pro.rating.average.toFixed(1)} ({pro.rating.isDefault ? "New" : pro.rating.count})
                {price ? ` · ${price} base` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="text-[11px] font-bold text-muted-foreground">Zip code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
            placeholder="Your zip"
          />
        </label>
        <label className="mb-3 block">
          <span className="text-[11px] font-bold text-muted-foreground">Your timeline</span>
          <select
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          >
            <option value="">Select answer</option>
            {TIMELINE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="text-[11px] font-bold text-muted-foreground">Estimated hours</span>
          <select
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          >
            <option value="">Select answer</option>
            {HOURS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Project type</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map((o) => {
              const on = projectTypes.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(projectTypes, o.id, setProjectTypes)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    on ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Work focus</p>
          <div className="flex flex-wrap gap-2">
            {WORK_FOCUS.slice(0, 8).map((o) => {
              const on = workFocus.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(workFocus, o.id, setWorkFocus)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    on ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything else the helper should know?"
          className="mb-4 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
        />

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Check availability
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Creates a gig in Jobs behind the scenes · powered by YAJ
        </p>
      </div>
    </div>
  );
}
