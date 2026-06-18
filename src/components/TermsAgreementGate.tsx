import { useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";

const TermsAgreementGate = ({ onAccept }: { onAccept: () => void }) => {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary mb-6">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-2 text-center">
          Terms of Use
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Please review and accept our terms before continuing.
        </p>

        <div className="w-full max-h-48 overflow-y-auto rounded-xl bg-card border border-border p-4 mb-6 text-xs text-muted-foreground leading-relaxed space-y-3">
          <p>By using WHEUAT, you agree to the following:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>WHEUAT is a unified platform: creator app, TV, and the Catch Up Circle (community savings & fundraisers).</li>
            <li>One account works across the entire platform.</li>
            <li>The Catch Up Circle (savings rotations, fundraisers, payouts) is restricted to users aged 18 and over.</li>
            <li>Artists must upload only original or properly licensed content. No external copyrighted music on Radio.</li>
            <li>Platform fees: 8% project funding, 15% downloads, plus Circle/Stripe processing fees where applicable.</li>
            <li>Pro tier is $10/month with DMs, Store, Analytics, Legal Vault, Boosts, Jhi AI, and Zero Ads.</li>
            <li>Payments processed through Stripe and Stripe Connect.</li>
            <li>False reporting, fraud, or false accusations may result in suspension or permanent deactivation.</li>
            <li>Prohibited: harmful content, impersonation, fraud, harassment.</li>
            <li>WHEUAT provides the platform "as is" with no warranties.</li>
          </ul>
          <p>
            For full terms, view the{" "}
            <button onClick={() => navigate("/terms")} className="text-primary underline">
              complete Terms of Use & Privacy Policy
            </button>
            .
          </p>
        </div>

        <label className="flex items-start gap-3 mb-4 cursor-pointer w-full">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I have read and agree to the WHEUAT Terms of Use and Privacy Policy.
          </span>
        </label>

        <button
          onClick={onAccept}
          disabled={!agreed}
          className={`w-full py-3 rounded-xl font-display font-bold text-sm transition-all ${
            agreed
              ? "gradient-primary text-primary-foreground glow-primary"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Continue to WHEUAT
        </button>
      </motion.div>
    </div>
  );
};

export default TermsAgreementGate;
