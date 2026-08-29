import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ageBandFromDob } from "@/lib/safety-balance";

type Props = {
  onComplete: (dob: string) => void | Promise<void>;
  onUnder13?: () => void;
};

/**
 * Age assurance gate — DOB first. Users cannot self-select "adult" / "teen".
 */
const AgeAssuranceGate = ({ onComplete, onUnder13 }: Props) => {
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }
    const band = ageBandFromDob(dob);
    if (band === "under_13") {
      onUnder13?.();
      setError("YAJ social accounts are currently available for users 13 and older.");
      return;
    }
    if (band === "unknown") {
      setError("Please enter a valid date of birth.");
      return;
    }
    setBusy(true);
    try {
      await onComplete(dob);
    } catch (e: any) {
      setError(e?.message || "Could not save date of birth.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2 text-center">
          Confirm your age
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          YAJ uses your date of birth to apply the right safety settings. You cannot choose adult or teen manually.
        </p>

        <div className="relative w-full mb-3">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive text-center mb-3 w-full">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue"}
        </button>

        <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed">
          Under-13 accounts are not available at launch. Teen accounts automatically receive YAJ Youth protections.
        </p>
      </motion.div>
    </div>
  );
};

export default AgeAssuranceGate;
