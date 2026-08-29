import { motion } from "framer-motion";
import { Moon, Shield, Timer, MessageSquareLock, MapPinOff } from "lucide-react";

type Props = {
  onContinue: () => void | Promise<void>;
};

const YouthWelcomeGate = ({ onContinue }: Props) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-5 mx-auto">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="text-xs font-semibold tracking-wide text-primary text-center mb-1">YAJ Youth</p>
        <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
          Your space, with extra protections built in
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Connect without getting consumed. These protections turn on automatically — you don’t have to enable them.
        </p>

        <ul className="space-y-3 mb-8">
          {[
            { icon: Shield, text: "Private profile by default" },
            { icon: MessageSquareLock, text: "Restricted DMs from unknown adults" },
            { icon: MapPinOff, text: "Exact location sharing off" },
            { icon: Timer, text: "Daily social time limit" },
            { icon: Moon, text: "Quiet nights for your feed & alerts" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-foreground">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void onContinue()}
          className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold"
        >
          Continue to YAJ
        </button>
      </motion.div>
    </div>
  );
};

export default YouthWelcomeGate;
