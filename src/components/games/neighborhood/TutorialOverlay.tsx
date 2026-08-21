import { useState } from "react";
import { Compass, HandHeart, MessageCircle, Sparkles } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  { icon: Compass, title: "Explore", body: "Walk around YAJ Central. Drag anywhere to move, or use WASD on desktop." },
  { icon: MessageCircle, title: "Talk", body: "Meet people around the block and accept the missions they offer." },
  { icon: HandHeart, title: "Help", body: "Complete tasks — find things, deliver things — and earn XP." },
  { icon: Sparkles, title: "Discover", body: "Find hidden YAJ Stars and secret spots scattered around the neighborhood." },
];

/** First-time-only 4-step tutorial, reopenable anytime from the start screen's "How to Play". */
export default function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black/85 px-8 text-center backdrop-blur-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6B3FA0]">
        <s.icon className="h-8 w-8 text-white" />
      </div>
      <p className="text-2xl font-black uppercase tracking-widest text-white">{s.title}</p>
      <p className="max-w-[280px] text-sm text-white/70">{s.body}</p>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-[#FFD166]" : "bg-white/25"}`} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => (last ? onClose() : setStep((n) => n + 1))}
        className="rounded-full bg-[#FF7A59] px-8 py-3 text-sm font-black uppercase tracking-wide text-white"
      >
        {last ? "Start Exploring" : "Next"}
      </button>
    </div>
  );
}
