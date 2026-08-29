import { motion } from "framer-motion";

type Props = {
  minutes: number;
  onContinue: () => void;
  onBreak: () => void;
};

/** Neutral take-a-break prompt — no shaming. */
const ContinuousUseReminder = ({ minutes, onContinue, onBreak }: Props) => {
  return (
    <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-lg"
      >
        <p className="text-xs font-semibold text-primary mb-1">Still enjoying YAJ?</p>
        <h2 className="text-lg font-display font-bold text-foreground mb-2">
          You’ve been exploring for {minutes} minutes
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Taking a short break is always okay. YAJ won’t punish you for stepping away.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onBreak}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold"
          >
            Take a break
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold"
          >
            Keep going
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ContinuousUseReminder;
