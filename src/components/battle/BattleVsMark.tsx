import { motion } from "framer-motion";

/** Big UFC/Verzuz-style VS mark with subtle glow. */
export default function BattleVsMark({
  size = "md",
  finalMinute = false,
}: {
  size?: "sm" | "md" | "lg";
  finalMinute?: boolean;
}) {
  const box =
    size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-10 w-10 text-[11px]" : "h-14 w-14 text-sm";

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        aria-hidden
        className={`absolute rounded-full ${finalMinute ? "bg-rose-500/35" : "bg-amber-400/25"} ${
          size === "lg" ? "h-20 w-20" : size === "sm" ? "h-12 w-12" : "h-16 w-16"
        }`}
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
        transition={{ repeat: Infinity, duration: finalMinute ? 0.9 : 1.8 }}
      />
      <div className="flex items-center gap-1.5">
        <span className="h-px w-5 bg-gradient-to-r from-transparent to-white/40 sm:w-8" />
        <motion.div
          animate={{ boxShadow: finalMinute
            ? ["0 0 12px rgba(244,63,94,0.5)", "0 0 28px rgba(244,63,94,0.85)", "0 0 12px rgba(244,63,94,0.5)"]
            : ["0 0 10px rgba(251,191,36,0.35)", "0 0 22px rgba(251,191,36,0.7)", "0 0 10px rgba(251,191,36,0.35)"]
          }}
          transition={{ repeat: Infinity, duration: finalMinute ? 0.8 : 1.6 }}
          className={`relative z-10 flex ${box} items-center justify-center rounded-full bg-gradient-to-br from-stone-900 via-stone-800 to-black font-black tracking-[0.2em] text-amber-200 ring-2 ring-amber-300/70`}
        >
          VS
        </motion.div>
        <span className="h-px w-5 bg-gradient-to-l from-transparent to-white/40 sm:w-8" />
      </div>
    </div>
  );
}
