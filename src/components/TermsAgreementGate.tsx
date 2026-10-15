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

        <div className="mb-6 max-h-52 w-full space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p>By using YAJ, you agree to the following:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>One YAJ account works across the app's social, local discovery, Marketplace, Radio, Games, wellness, and AI features.</li>
            <li>You may only post or upload content you have the right to use.</li>
            <li>Harassment, scams, impersonation, illegal activity, spam, and other harmful conduct are prohibited.</li>
            <li>Marketplace sellers, service providers, employers, event hosts, and other users are responsible for the accuracy of their own listings and offers.</li>
            <li>Location information you choose to provide may be used to show nearby Deals, Marketplace items, Jobs, Events, Local Help, and Gigs.</li>
            <li>YAJ AI may make mistakes and should not replace qualified professional advice for important decisions.</li>
            <li>YAJ may moderate content or restrict accounts when needed for safety, fraud prevention, legal compliance, or enforcement of the Terms.</li>
            <li>You can manage privacy, blocking, local discovery, support, and account deletion from Settings and Help.</li>
          </ul>
          <p>
            For full details, view the{" "}
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
            I have read and agree to the YAJ Terms of Use and Privacy Policy.
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
          Continue to YAJ
        </button>
      </motion.div>
    </div>
  );
};

export default TermsAgreementGate;
