import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Phone } from "lucide-react";
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

        {/* Scrollable terms summary */}
        <div className="w-full max-h-48 overflow-y-auto rounded-xl bg-card border border-border p-4 mb-6 text-xs text-muted-foreground leading-relaxed space-y-3">
          <p>By using WHEUAT, you agree to the following:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Artists must upload only original or properly licensed content.</li>
            <li>No external copyrighted music is allowed on Radio.</li>
            <li>Platform fees: 10% studio bookings, 8% project funding, 15% downloads.</li>
            <li>Pro Artist subscription is $7.99/month with Legal Vault, Verified Badge, Analytics, and Featured Placement.</li>
            <li>All payments processed through Stripe. Payouts via Stripe Connect.</li>
            <li>Prohibited: harmful content, impersonation, fraud, harassment.</li>
            <li>WHEUAT provides the platform "as is" with no warranties.</li>
          </ul>
          <p>
            For full terms, view the{" "}
            <button
              onClick={() => navigate("/terms")}
              className="text-primary underline"
            >
              complete Terms of Use
            </button>
            .
          </p>
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 mb-4 cursor-pointer w-full">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I have read and agree to the WHEUAT Terms of Use.
          </span>
        </label>

        {/* Phone agreement option */}
        <div className="flex items-center gap-2 mb-6 w-full">
          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">
            Or call <strong className="text-primary">954-607</strong> to agree to terms.
          </span>
        </div>

        {/* Accept button */}
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
