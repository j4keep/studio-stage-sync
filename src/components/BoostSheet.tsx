import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket, X, DollarSign, Clock, Zap, TrendingUp, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface BoostSheetProps {
  open: boolean;
  onClose: () => void;
  contentType: "song" | "video" | "studio" | "store_product";
  contentId: string;
  contentTitle: string;
}

const DURATION_OPTIONS = [
  { days: 1, label: "1 Day", desc: "Quick visibility burst" },
  { days: 3, label: "3 Days", desc: "Short campaign" },
  { days: 7, label: "7 Days", desc: "Full week reach", popular: true },
  { days: 14, label: "14 Days", desc: "Extended promotion" },
  { days: 30, label: "30 Days", desc: "Maximum exposure" },
];

const BUDGET_PRESETS = [5, 10, 25, 50, 100];

const BoostSheet = ({ open, onClose, contentType, contentId, contentTitle }: BoostSheetProps) => {
  const { user } = useAuth();
  const [budget, setBudget] = useState(10);
  const [customBudget, setCustomBudget] = useState("");
  const [duration, setDuration] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  const activeBudget = customBudget ? parseFloat(customBudget) || 0 : budget;
  const estimatedReach = Math.round(activeBudget * duration * 50);
  const contentTypeLabel = contentType === "store_product" ? "Product" : contentType.charAt(0).toUpperCase() + contentType.slice(1);

  const handleSubmit = async () => {
    if (!user || activeBudget < 1) {
      toast({ title: "Minimum budget is $1", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    const { error } = await (supabase as any).from("boosts").insert({
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      budget: activeBudget,
      duration_days: duration,
      end_date: endDate.toISOString(),
      status: "active",
    });

    if (error) {
      toast({ title: "Boost failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Boost activated! 🚀", description: `"${contentTitle}" is now promoted for ${duration} days` });
      onClose();
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full max-w-lg bg-card rounded-t-2xl border-t border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold text-foreground">Boost {contentTypeLabel}</h2>
              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{contentTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Budget Section */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-primary" /> Set Your Budget
            </p>
            <div className="flex gap-2 flex-wrap mb-2">
              {BUDGET_PRESETS.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBudget(b); setCustomBudget(""); }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    !customBudget && budget === b
                      ? "gradient-primary text-primary-foreground glow-primary"
                      : "bg-muted text-foreground border border-border hover:border-primary/30"
                  }`}
                >
                  ${b}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                min="1"
                placeholder="Custom amount"
                value={customBudget}
                onChange={(e) => setCustomBudget(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 outline-none"
              />
            </div>
          </div>

          {/* Duration Section */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Campaign Duration
            </p>
            <div className="flex flex-col gap-1.5">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.days}
                  onClick={() => setDuration(d.days)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    duration === d.days
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/50 border border-border hover:border-primary/20"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    duration === d.days ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {duration === d.days && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold text-foreground">{d.label}</p>
                    <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                  </div>
                  {d.popular && (
                    <span className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">POPULAR</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Reach */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">Estimated Performance</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-sm font-bold text-primary">{estimatedReach.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">Impressions</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-primary">{Math.round(estimatedReach * 0.03).toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">Est. Clicks</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-primary">${activeBudget.toFixed(2)}</p>
                <p className="text-[9px] text-muted-foreground">Total Cost</p>
              </div>
            </div>
          </div>

          {/* What You Get */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" /> What You Get
            </p>
            <div className="space-y-1.5">
              {[
                "Featured banner placement on browse pages",
                "\"Promoted\" badge on your content",
                "Priority placement in search results",
                "Real-time impression & click tracking",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || activeBudget < 1}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" />
            {submitting ? "Processing..." : `Boost for $${activeBudget.toFixed(2)}`}
          </button>

          <p className="text-[9px] text-center text-muted-foreground">
            Platform fee: 15% · Boost starts immediately after payment
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default BoostSheet;
