import { useEffect, useRef, useState } from "react";
import { X, Sparkles, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { URGENCY_OPTIONS } from "@/lib/jobs";
import { analyzeGigPhotos, fileToDataUrl } from "@/lib/yaj-jobs-ai";
import GigProfileCard, { type GigProfileInfo } from "@/components/jobs/GigProfileCard";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

export default function PostGigSheet({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<GigProfileInfo | null>(null);
  const [hideYajProfile, setHideYajProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!open || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, hide_yaj_page_on_gigs")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMyProfile({
          user_id: data.user_id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        });
        setHideYajProfile(Boolean((data as any).hide_yaj_page_on_gigs));
      } else {
        setMyProfile({
          user_id: user.id,
          display_name: user.email?.split("@")[0] || "You",
          avatar_url: null,
        });
      }
    })();
  }, [open, user]);

  if (!open) return null;

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const remaining = 4 - photos.length;
    const chosen = Array.from(files).slice(0, remaining);
    const urls = await Promise.all(chosen.map(fileToDataUrl));
    setPhotos((p) => [...p, ...urls]);
  };

  const analyze = async () => {
    if (!photos.length) {
      toast.error("Add at least one photo first");
      return;
    }
    setAnalyzing(true);
    setAiTip(null);
    try {
      const r = await analyzeGigPhotos(photos, form.description || form.title);
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        description: r.description || f.description,
        category: r.category || f.category,
        urgency: r.urgency || f.urgency,
        budget_min: r.budget_min ? String(r.budget_min) : f.budget_min,
        budget_max: r.budget_max ? String(r.budget_max) : f.budget_max,
      }));
      if (r.tips) setAiTip(r.tips);
      toast.success("YAJ Buddy filled in your gig details!");
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
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
    setSaving(true);
    const { error } = await (supabase as any).from("gig_listings").insert({
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
      hide_yaj_profile: hideYajProfile,
    });
    if (!error) {
      await (supabase as any)
        .from("profiles")
        .update({ hide_yaj_page_on_gigs: hideYajProfile })
        .eq("user_id", user.id);
    }
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
    <div className="fixed inset-0 z-[70] bg-background flex flex-col md:items-center md:justify-center md:bg-black/60">
      <div className="w-full h-full md:h-[92vh] md:max-w-2xl md:rounded-2xl md:overflow-hidden bg-background flex flex-col">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">

        <GigProfileCard
          label="Your profile on this gig"
          profile={myProfile}
          hideYajPage={hideYajProfile}
          onToggleHide={setHideYajProfile}
          toggleLabel="Hide my YAJ page account — others only see your picture and name"
        />

        <div className="rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-primary/20 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">YAJ AI Gig Assistant</span> — upload photos and Buddy will suggest a title, description, category, and price range.
            </p>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={p} className="w-full h-full object-cover" alt="" />
                  <button
                    onClick={() => setPhotos((ph) => ph.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photos.length >= 4}
              className="flex-1 h-10 rounded-xl bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {photos.length ? `Add photo (${photos.length}/4)` : "Add photos"}
            </button>
            <button
              onClick={analyze}
              disabled={analyzing || !photos.length}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? "Analyzing…" : "Analyze with AI"}
            </button>
          </div>

          {aiTip && (
            <p className="text-[11px] text-primary bg-primary/10 rounded-lg px-2 py-1.5 leading-snug">
              💡 {aiTip}
            </p>
          )}
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
