import { useState } from "react";
import { Camera, Film, ImagePlus } from "lucide-react";
import { analyzeGigPhotos, type GigAiResult } from "@/lib/yaj-jobs-ai";
import { estimateMediaFrames } from "@/lib/estimate-attachments";
import ConcreteRepairEstimate from "@/components/local-help/ConcreteRepairEstimate";
import GigEstimateDetails from "@/components/local-help/GigEstimateDetails";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { estimateLocalHelpNeed, getLocalHelpCategory } from "@/lib/local-help";
import { hireLocalHelper } from "@/lib/pro-profiles";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  preferredHelperId?: string;
  preferredHelperName?: string;
};

export default function AskYajHelpSheet({ open, onClose, preferredHelperId, preferredHelperName }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [estimate, setEstimate] = useState<ReturnType<typeof estimateLocalHelpNeed> | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [mediaLabel, setMediaLabel] = useState("");
  const [aiAssessment, setAiAssessment] = useState<GigAiResult | null>(null);
  const [reviewedBudget, setReviewedBudget] = useState<{ low: number; high: number } | null>(null);
  const [showConcrete, setShowConcrete] = useState(false);

  if (!open) return null;

  const runEstimate = () => {
    if (!text.trim()) return toast.error("Describe what you need");
    setEstimate(estimateLocalHelpNeed(text));
  };

  const attachMedia = async (file: File | undefined) => {
    if (!file) return;
    setAnalyzing(true);
    setAiAssessment(null);
    setReviewedBudget(null);
    try {
      setFrames(await estimateMediaFrames(file));
      setMediaLabel(file.name);
      toast.success(file.type.startsWith("video/") ? "Three sample video frames ready" : "Photo ready");
    } catch (error) {
      setFrames([]);
      setMediaLabel("");
      toast.error(error instanceof Error ? error.message : "Could not read attachment");
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeMedia = async () => {
    if (!frames.length) return toast.error("Attach a photo or short video first");
    setAnalyzing(true);
    try {
      const result = await analyzeGigPhotos(frames, text);
      setAiAssessment(result);
      if (/concrete|cement|spall|crack|sidewalk/i.test([result.title, result.description, text].join(" "))) setShowConcrete(true);
      toast.success("Preliminary work scope ready — confirm measurements and pricing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo analysis failed");
    } finally { setAnalyzing(false); }
  };

  const postNeed = async () => {
    if (!user) return toast.error("Sign in first");
    const e = estimate || estimateLocalHelpNeed(text);
    const title = aiAssessment?.title || e.title;
    const description = aiAssessment?.description || e.description;
    const categoryId = aiAssessment?.category || e.categoryId;
    const budgetLow = reviewedBudget?.low ?? (aiAssessment ? aiAssessment.budget_min : e.budgetLow);
    const budgetHigh = reviewedBudget?.high ?? (aiAssessment ? aiAssessment.budget_max : e.budgetHigh);
    setSaving(true);
    try {
      if (preferredHelperId) {
        const gig = await hireLocalHelper({
          customerId: user.id,
          helperId: preferredHelperId,
          title,
          description,
          category: categoryId,
          budgetMin: budgetLow ?? undefined,
          budgetMax: budgetHigh ?? undefined,
        });
        toast.success("Request sent");
        onClose();
        nav("/messages", {
          state: {
            startWithUserId: preferredHelperId,
            startWithProfile: {
              user_id: preferredHelperId,
              display_name: preferredHelperName || "Helper",
              avatar_url: null,
            },
            gigTitle: gig.title,
            gigId: gig.id,
          },
        });
        return;
      }

      const { data: gig, error } = await (supabase as any)
        .from("gig_listings")
        .insert({
          poster_id: user.id,
          title,
          description,
          category: categoryId,
          status: "open",
          urgency: "flexible",
          budget_min: budgetLow,
          budget_max: budgetHigh,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Need posted — helpers can respond");
      onClose();
      nav(`/gigs/${gig.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not post");
    } finally {
      setSaving(false);
    }
  };

  const browseCategory = () => {
    const e = estimate || estimateLocalHelpNeed(text || "help");
    onClose();
    nav(`/local-help/${aiAssessment?.category || e.categoryId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black">Ask YAJ Buddy</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Describe a repair or attach a photo/short video. AI suggests the visible scope; you confirm measurements, materials and prices before using any estimate.
        </p>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEstimate(null);
            setAiAssessment(null);
            setReviewedBudget(null);
          }}
          rows={4}
          placeholder="e.g. Hole in my drywall from moving a TV mount…"
          className="mt-3 w-full rounded-2xl border border-border bg-muted p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold">
            <ImagePlus className="h-4 w-4" /> Add photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { void attachMedia(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold">
            <Camera className="h-4 w-4" /> Camera
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void attachMedia(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold">
            <Film className="h-4 w-4" /> Short video
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { void attachMedia(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        {mediaLabel && <p className="mt-2 text-xs text-muted-foreground">Selected: {mediaLabel}. Video analysis uses three sampled frames, not the entire recording.</p>}
        {frames.length > 0 && (
          <button type="button" onClick={() => void analyzeMedia()} disabled={analyzing}
            className="mt-2 w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {analyzing ? "Analyzing…" : "Analyze photo / video with YAJ AI"}
          </button>
        )}
        <button
          type="button"
          onClick={runEstimate}
          className="mt-3 h-11 w-full rounded-2xl border border-primary/40 bg-primary/10 text-sm font-bold text-primary"
        >
          Analyze with Buddy
        </button>

        {aiAssessment && <div className="mt-3"><GigEstimateDetails result={aiAssessment} /></div>}

        {estimate && (
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Detected</p>
            <p className="text-sm font-bold">{estimate.title}</p>
            <p className="text-[12px] text-muted-foreground">{estimate.description}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-semibold">{getLocalHelpCategory(estimate.categoryId)?.label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold">{estimate.duration}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="font-semibold">
                  ${estimate.budgetLow}–${estimate.budgetHigh}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Skills</dt>
                <dd className="font-semibold">{estimate.skills.join(", ")}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <button type="button" onClick={() => setShowConcrete((v) => !v)}
            className="w-full rounded-xl border border-border p-3 text-left text-sm font-semibold">
            {showConcrete ? "Hide" : "Open"} concrete crack / patch material calculator
          </button>
          {showConcrete && <ConcreteRepairEstimate onUseBudget={(low, high) => {
            setReviewedBudget({ low, high });
            toast.success("Measured budget range applied");
          }} />}
          {reviewedBudget && <p className="text-xs font-bold">Reviewed proposal range: ${reviewedBudget.low}–${reviewedBudget.high}</p>}
        </div>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={saving || (!text.trim() && !aiAssessment)}
            onClick={() => void postNeed()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {preferredHelperId ? "Send to this helper" : "Post need as gig"}
          </button>
          <button type="button" onClick={browseCategory} className="h-11 rounded-2xl border border-border text-sm font-bold">
            Browse matching helpers
          </button>
        </div>
      </div>
    </div>
  );
}
