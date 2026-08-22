import { useState } from "react";
import { Candy, Move, Siren, Sparkles } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  { icon: Move, title: "Move", body: "Swipe through Candy City — or use arrow keys / WASD on desktop." },
  { icon: Candy, title: "Collect", body: "Grab treats to fill the Sugar Meter at the bottom of the screen." },
  { icon: Siren, title: "Escape", body: "Stay away from Dr. Cavity — he's chasing you because you're eating too much sugar." },
  { icon: Sparkles, title: "Rush", body: "Fill the meter to activate Sugar Rush Mode — you speed up and Dr. Cavity backs off." },
];

/** First-time-only 4-step tutorial, reopenable anytime from the intro's "How to Play" —
 *  mirrors the neighborhood/TutorialOverlay.tsx open/onClose/step pattern, own content
 *  and palette. */
export default function SugarRushTutorial({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-black/85 px-8 text-center backdrop-blur-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(160deg, #ff6fa3, #a34fd6)" }}>
        <s.icon className="h-8 w-8 text-white" />
      </div>
      <p className="text-2xl font-black uppercase tracking-widest text-white">{s.title}</p>
      <p className="max-w-[280px] text-sm text-white/70">{s.body}</p>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-yellow-300" : "bg-white/25"}`} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => (last ? onClose() : setStep((n) => n + 1))}
        className="rounded-full px-8 py-3 text-sm font-black uppercase tracking-wide text-white active:scale-95"
        style={{ background: "linear-gradient(135deg, #ff8a2e, #ff5ecb)" }}
      >
        {last ? "Start Rushing" : "Next"}
      </button>
    </div>
  );
}
