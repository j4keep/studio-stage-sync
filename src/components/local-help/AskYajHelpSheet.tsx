import { useState } from "react";
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

  if (!open) return null;

  const runEstimate = () => {
    if (!text.trim()) return toast.error("Describe what you need");
    setEstimate(estimateLocalHelpNeed(text));
  };

  const postNeed = async () => {
    if (!user) return toast.error("Sign in first");
    const e = estimate || estimateLocalHelpNeed(text);
    setSaving(true);
    try {
      if (preferredHelperId) {
        const gig = await hireLocalHelper({
          customerId: user.id,
          helperId: preferredHelperId,
          title: e.title,
          description: e.description,
          category: e.categoryId,
          budgetMin: e.budgetLow,
          budgetMax: e.budgetHigh,
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
          title: e.title,
          description: e.description,
          category: e.categoryId,
          status: "open",
          urgency: "flexible",
          budget_min: e.budgetLow,
          budget_max: e.budgetHigh,
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
    nav(`/local-help/${e.categoryId}`);
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
          Describe the job in your own words. Buddy suggests category, budget, and next steps.
        </p>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEstimate(null);
          }}
          rows={4}
          placeholder="e.g. Hole in my drywall from moving a TV mount…"
          className="mt-3 w-full rounded-2xl border border-border bg-muted p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />

        <button
          type="button"
          onClick={runEstimate}
          className="mt-3 h-11 w-full rounded-2xl border border-primary/40 bg-primary/10 text-sm font-bold text-primary"
        >
          Analyze with Buddy
        </button>

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

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={saving || !text.trim()}
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
