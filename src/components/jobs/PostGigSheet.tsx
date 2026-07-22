import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { URGENCY_OPTIONS } from "@/lib/jobs";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

export default function PostGigSheet({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    location: "",
    budget_min: "",
    budget_max: "",
    urgency: "flexible",
    preferred_date: "",
    preferred_time: "",
  });

  if (!open) return null;

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("gig_listings").insert({
      poster_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      location: form.location.trim() || null,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      urgency: form.urgency,
      preferred_date: form.preferred_date || null,
      preferred_time: form.preferred_time || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gig posted!");
    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold">Post a Gig</h2>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
        >
          {saving ? "Posting…" : "Publish"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-primary/20 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">YAJ AI Assistant</span> — upload photos and Buddy will suggest a title, description, and pricing. <span className="opacity-60">(Coming soon in Phase 2)</span>
          </p>
        </div>

        <Field label="Gig Title *">
          <input value={form.title} onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Need my TV mounted" className={inputCls} />
        </Field>

        <Field label="Description *">
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)}
            rows={5} placeholder="What needs to be done, size, materials, access, etc." className={inputCls} />
        </Field>

        <Field label="Category">
          <input value={form.category} onChange={(e) => update("category", e.target.value)}
            placeholder="handyman, delivery, design…" className={inputCls} />
        </Field>

        <Field label="Location">
          <input value={form.location} onChange={(e) => update("location", e.target.value)}
            placeholder="City, State or ZIP" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget Min ($)">
            <input inputMode="numeric" value={form.budget_min} onChange={(e) => update("budget_min", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Budget Max ($)">
            <input inputMode="numeric" value={form.budget_max} onChange={(e) => update("budget_max", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Urgency">
          <select value={form.urgency} onChange={(e) => update("urgency", e.target.value)} className={inputCls}>
            {URGENCY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred Date">
            <input type="date" value={form.preferred_date} onChange={(e) => update("preferred_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Preferred Time">
            <input value={form.preferred_time} onChange={(e) => update("preferred_time", e.target.value)}
              placeholder="Morning, 3pm, etc." className={inputCls} />
          </Field>
        </div>

        <div className="h-8" />
      </div>
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
