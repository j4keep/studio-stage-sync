import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, Check, Crown, Zap, Music, Video, BarChart3, MessageCircle, FileText, Building2, ShoppingBag, Ban } from "lucide-react";

interface ProGateModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
  onSubscribe?: () => void;
}

const PRO_FEATURES = [
  { icon: MessageCircle, label: "Direct Messaging" },
  { icon: ShoppingBag, label: "Open Your Store" },
  { icon: BarChart3, label: "Analytics & Earnings" },
  { icon: Building2, label: "List & Book Studios" },
  { icon: FileText, label: "Legal Vault Access" },
  { icon: Zap, label: "Boosts & Promotions" },
  { icon: Crown, label: "Ask Jhi AI Assistant" },
  { icon: Ban, label: "Zero Ads Experience" },
];

const ProGateModal = ({ open, onClose, featureName, onSubscribe }: ProGateModalProps) => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const monthlyPrice = 10;
  const yearlyPrice = 100; // ~$8.33/mo

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-card border border-border overflow-hidden"
        >
          {/* Header */}
          <div className="relative p-6 pb-4 text-center gradient-primary">
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white/80">
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-display font-bold text-white">Unlock PRO</h2>
            {featureName && (
              <p className="text-sm text-white/80 mt-1">
                <span className="font-semibold">{featureName}</span> requires a PRO subscription
              </p>
            )}
          </div>

          {/* Features */}
          <div className="px-5 pt-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              {PRO_FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
                  <f.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-[10px] font-medium text-foreground leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="px-5 pt-3">
            <div className="flex gap-2 p-1 rounded-xl bg-secondary">
              <button
                onClick={() => setBilling("monthly")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  billing === "monthly" ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all relative ${
                  billing === "yearly" ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Yearly
                <span className="absolute -top-1.5 -right-1 text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">SAVE 17%</span>
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="px-5 pt-4 pb-2 text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                ${billing === "monthly" ? monthlyPrice : yearlyPrice}
              </span>
              <span className="text-sm text-muted-foreground">
                /{billing === "monthly" ? "month" : "year"}
              </span>
            </div>
            {billing === "yearly" && (
              <p className="text-[10px] text-green-500 font-medium mt-1">That's just $8.33/month!</p>
            )}
          </div>

          {/* Subscribe Button */}
          <div className="p-5 pt-3">
            <button
              onClick={() => onSubscribe?.()}
              className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Subscribe to PRO
            </button>
            <p className="text-[9px] text-muted-foreground text-center mt-2">Cancel anytime · Instant access to all features</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProGateModal;
