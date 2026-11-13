import { useEffect, useRef, useState } from "react";
import { X, Sparkles, ImagePlus, Loader2, Camera, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { URGENCY_OPTIONS } from "@/lib/jobs";
import { analyzeGigPhotos, fileToDataUrl, type GigAiResult } from "@/lib/yaj-jobs-ai";
import { estimateMediaFrames } from "@/lib/estimate-attachments";
import ConcreteRepairEstimate from "@/components/local-help/ConcreteRepairEstimate";
import GigEstimateDetails from "@/components/local-help/GigEstimateDetails";
import GigProfileCard, { type GigProfileInfo } from "@/components/jobs/GigProfileCard";

type GigEdit = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  preferred_date: string | null;
  preferred_time: string | null;
  hide_yaj_profile?: boolean;
  media?: any;
};

type GigPhoto = { preview: string; file?: File; url?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  gigToEdit?: GigEdit | null;
  /** Open the camera/photo picker as soon as the sheet appears (Snap-a-photo flow). */
  autoOpenPhotos?: boolean;
};

const MAX_GIG_PHOTOS = 6;
const EMPTY_GIG_FORM = {
  title: "", description: "", category: "general", location: "",
  budget_min: "", budget_max: "", urgency: "flexible",
  preferred_date: "", preferred_time: "",
};

export default function PostGigSheet({ open, onClose, onCreated, gigToEdit, autoOpenPhotos }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photos, setPhotos] = useState<GigPhoto[]>([]);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<GigAiResult | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [showConcrete, setShowConcrete] = useState(false);
  const [myProfile, setMyProfile] = useState<GigProfileInfo | null>(null);
  const [hideYajProfile, setHideYajProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...EMPTY_GIG_FORM });
  const [estimateRevision, setEstimateRevision] = useState(0);
  const analysisVersionRef = useRef(0);
  const lastAiFieldsRef = useRef<Partial<typeof EMPTY_GIG_FORM> | null>(null);

  const clearAnalysis = () => {
    analysisVersionRef.current += 1;
    setAiTip(null);
    setAiReport(null);
    setShowConcrete(false);
    setEstimateRevision((revision) => revision + 1);
    setForm((current) => {
      const previous = lastAiFieldsRef.current;
      lastAiFieldsRef.current = null;
      if (!previous) return { ...current, budget_min: "", budget_max: "" };
      const next = { ...current, budget_min: "", budget_max: "" };
      for (const field of ["title", "description", "category", "urgency"] as const) {
        if (previous[field] != null && next[field] === previous[field]) {
          next[field] = EMPTY_GIG_FORM[field];
        }
      }
      return next;
    });
  };

  const resetDraft = () => {
    analysisVersionRef.current += 1;
    lastAiFieldsRef.current = null;
    setPhotos([]);
    setVideoFrames([]);
    setAiTip(null);
    setAiReport(null);
    setShowConcrete(false);
    setEstimateRevision((revision) => revision + 1);
    setForm({ ...EMPTY_GIG_FORM });
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const closeDraft = () => {
    if (saving) return;
    const hasUnsaved = photos.length > 0 || videoFrames.length > 0 ||
      Boolean(form.title.trim() || form.description.trim() || form.budget_min || form.budget_max);
    if (hasUnsaved && !window.confirm("Discard this unsaved gig?")) return;
    resetDraft();
    onClose();
  };

  const startNewGig = () => {
    if (saving || analyzing) return;
    const hasUnsaved = photos.length > 0 || videoFrames.length > 0 ||
      Boolean(form.title.trim() || form.description.trim() || form.budget_min || form.budget_max);
    if (hasUnsaved && !window.confirm("Clear the photos, AI estimate and all gig details to start over?")) return;
    resetDraft();
    toast.success("Ready for a new gig");
  };

  useEffect(() => {
    if (!open || !gigToEdit) return;
    setForm({
      title: gigToEdit.title || "",
      description: gigToEdit.description || "",
      category: gigToEdit.category || "general",
      location: gigToEdit.location || "",
      budget_min: gigToEdit.budget_min != null ? String(gigToEdit.budget_min) : "",
      budget_max: gigToEdit.budget_max != null ? String(gigToEdit.budget_max) : "",
      urgency: gigToEdit.urgency || "flexible",
      preferred_date: gigToEdit.preferred_date || "",
      preferred_time: gigToEdit.preferred_time || "",
    });
    setHideYajProfile(Boolean(gigToEdit.hide_yaj_profile));
    const existing = Array.isArray(gigToEdit.media) ? gigToEdit.media : [];
    setPhotos(
      existing
        .map((m: any) => (typeof m === "string" ? m : m?.url))
        .filter(Boolean)
        .slice(0, MAX_GIG_PHOTOS)
        .map((url: string) => ({ preview: url, url })),
    );
  }, [open, gigToEdit]);

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

  useEffect(() => {
    if (!open || !autoOpenPhotos) return;
    const t = window.setTimeout(() => cameraRef.current?.click(), 250);
    return () => window.clearTimeout(t);
  }, [open, autoOpenPhotos]);

  if (!open) return null;

  const update = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "description" || k === "title" || k === "location") {
      // A changed scope invalidates an older AI proposal and its budget.
      analysisVersionRef.current += 1;
      setAiReport(null);
      setAiTip(null);
      setForm((f) => ({ ...f, budget_min: "", budget_max: "" }));
      if (k === "description" || k === "title") {
        const prospective = k === "description" ? v : [v, form.description].join(" ");
        setShowConcrete(/concrete|cement|spall|sidewalk|driveway/i.test(prospective));
      }
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const remaining = MAX_GIG_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Up to ${MAX_GIG_PHOTOS} photos`);
      return;
    }
    const chosen = Array.from(files).slice(0, remaining);
    const added = await Promise.all(
      chosen.map(async (file) => ({ preview: await fileToDataUrl(file), file })),
    );
    clearAnalysis();
    setVideoFrames([]);
    setPhotos((p) => [...p, ...added]);
  };

  const addEstimateVideo = async (file: File | undefined) => {
    if (!file) return;
    setAnalyzing(true);
    try {
      if (!file.type.startsWith("video/")) throw new Error("Choose a video file");
      const nextFrames = await estimateMediaFrames(file);
      clearAnalysis();
      setPhotos([]);
      setVideoFrames(nextFrames);
      toast.success("Three video frames ready for estimate; video is not added to the gig");
    } catch (error) {
      setVideoFrames([]);
      toast.error(error instanceof Error ? error.message : "Could not read video");
    } finally { setAnalyzing(false); }
  };

  const uploadPhotos = async (): Promise<{ url: string }[]> => {
    if (!user) return [];
    const out: { url: string }[] = [];
    for (const p of photos) {
      if (p.url) {
        out.push({ url: p.url });
        continue;
      }
      if (!p.file) continue;
      const ext = p.file.name.split(".").pop() || "jpg";
      const path = `gigs/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, p.file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      out.push({ url: pub.publicUrl });
    }
    return out;
  };

  const analyze = async () => {
    if (!photos.length && !videoFrames.length && !form.description.trim() && !form.title.trim()) {
      toast.error("Describe the work or attach a photo/video first");
      return;
    }
    setAnalyzing(true);
    const analysisVersion = ++analysisVersionRef.current;
    setAiTip(null);
    setAiReport(null);
    setShowConcrete(false);
    try {
      const r = await analyzeGigPhotos([...photos.map((p) => p.preview), ...videoFrames], [form.title, form.description, form.location ? `Location: ${form.location}` : ""].filter(Boolean).join("\n"));
      if (analysisVersion !== analysisVersionRef.current) return;
      setAiReport(r);
      const concreteJob = /concrete|cement|spall|sidewalk|driveway/i.test([r.title, r.description].join(" "));
      setShowConcrete(concreteJob);
      setEstimateRevision((revision) => revision + 1);
      lastAiFieldsRef.current = { title: r.title || "", description: form.description.trim() ? form.description : (r.description || ""), category: r.category || "general", urgency: r.urgency || "flexible" };
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        // Preserve the user\'s dimensions, scope and prices in their own words.
        description: f.description.trim() ? f.description : (r.description || ""),
        category: r.category || f.category,
        urgency: r.urgency || f.urgency,
        // Photos cannot validate labor/material prices: never reuse an old quote.
        budget_min: "",
        budget_max: "",
      }));
      if (r.tips) setAiTip(r.tips);
      toast.success("Preliminary AI scope ready — check materials and prices before posting");
    } catch (e: any) {
      if (analysisVersion === analysisVersionRef.current) toast.error(e.message || "AI analysis failed");
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
    let media: { url: string }[] = [];
    try {
      media = await uploadPhotos();
    } catch (e: any) {
      setSaving(false);
      toast.error(e?.message || "Photo upload failed");
      return;
    }
    const payload = {
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
      media,
    };

    let error: { message: string } | null = null;
    if (gigToEdit?.id) {
      const res = await (supabase as any).from("gig_listings").update(payload).eq("id", gigToEdit.id).eq("poster_id", user.id);
      error = res.error;
    } else {
      const res = await (supabase as any).from("gig_listings").insert({
        poster_id: user.id,
        ...payload,
      });
      error = res.error;
    }
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
    toast.success(gigToEdit ? "Gig updated!" : "Gig posted!");
    resetDraft();
    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background md:items-center md:justify-center md:bg-black/60">
      <div className="flex h-[100dvh] min-h-0 w-full flex-col bg-background md:h-[92dvh] md:max-w-2xl md:overflow-hidden md:rounded-2xl">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" aria-label="Close gig editor" onClick={closeDraft} disabled={saving} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center disabled:opacity-40">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold">{gigToEdit ? "Edit gig" : "Post a Gig"}</h2>
        {!gigToEdit && (
          <button type="button" onClick={startNewGig} disabled={saving || analyzing}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
        >
          {saving ? (gigToEdit ? "Saving…" : "Posting…") : gigToEdit ? "Save" : "Publish"}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-8">

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
              <span className="font-semibold text-foreground">Describe the job or add pictures</span> — YAJ Buddy can assess written measurements without a photo. Add up to {MAX_GIG_PHOTOS} photos for more context. Prices need local rates.
            </p>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={p.preview} className="w-full h-full object-cover" alt="" />
                  <button
                    onClick={() => { clearAnalysis(); setPhotos((ph) => ph.filter((_, j) => j !== i)); }}
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
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={photos.length >= MAX_GIG_PHOTOS}
              className="flex-1 h-10 rounded-xl bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Camera className="w-3.5 h-3.5" />
              Snap photo
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photos.length >= MAX_GIG_PHOTOS}
              className="flex-1 h-10 rounded-xl bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {photos.length ? `Upload (${photos.length}/${MAX_GIG_PHOTOS})` : "Upload"}
            </button>
            <button
              onClick={analyze}
              disabled={analyzing || (!photos.length && !videoFrames.length && !form.title.trim() && !form.description.trim())}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? "Analyzing…" : "Estimate with YAJ AI"}
            </button>
          </div>

          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold">
            Add short repair video (up to 90 sec / 40 MB)
            <input type="file" accept="video/*" className="hidden"
              onChange={(e) => { void addEstimateVideo(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {videoFrames.length > 0 && <p className="text-xs text-muted-foreground">
            Three video stills ready for AI. This video is for analysis only; attach photos for the published gig.
          </p>}
          {aiTip && (
            <p className="text-[11px] text-primary bg-primary/10 rounded-lg px-2 py-1.5 leading-snug">
              💡 {aiTip}
            </p>
          )}
        </div>
        {aiReport && <GigEstimateDetails result={aiReport} />}
        <div className="space-y-2">
          <button type="button" onClick={() => setShowConcrete((v) => !v)}
            className="w-full rounded-xl border border-border p-3 text-left text-sm font-semibold">
            {showConcrete ? "Hide" : "Open"} concrete repair materials + labor calculator (concrete jobs only)
          </button>
          {showConcrete && <ConcreteRepairEstimate key={estimateRevision} description={[form.title, form.description].filter(Boolean).join(" ")} onUseBudget={(low, high) => setForm((v) => ({
            ...v, budget_min: String(low), budget_max: String(high),
          }))} />}
        </div>

        <Field label="Gig Title *">
          <input value={form.title} onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Need my TV mounted" className={inputCls} />
        </Field>

        <p className="text-xs text-muted-foreground">
          Type your project size, material and expected work here (for example: "Repair 24 sq ft of concrete, 2 inches deep; $9 per bag; 4 labor hours at $70/hr").
          Tap <strong>Estimate with YAJ AI</strong> for a suggested scope, or open the calculator to see measurements filled from your text.
          AI requests may use credits; typing and local calculations do not.
        </p>
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

      </div>
      <footer className="shrink-0 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? (gigToEdit ? "Saving…" : "Posting…") : gigToEdit ? "Save gig" : "Post this Gig"}
        </button>
      </footer>
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
