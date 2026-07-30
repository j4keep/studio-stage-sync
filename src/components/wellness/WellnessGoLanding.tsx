import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  DEFAULT_HEALTH_PROFILE,
  updateWellnessProfile,
  WELLNESS_SKIN_TONES,
  type WellnessFigure,
  type WellnessSkinTone,
  type WellnessState,
} from "@/lib/wellness";

/** Welcome-page ambient loop (Go gate only — not exercise demos). */
const LANDING_VIDEO = "https://assets.mixkit.co/videos/32625/32625-720.mp4";

type Props = {
  onBack: () => void;
  onEnter: (state: WellnessState) => void;
};

/**
 * First wellness screen: cinematic welcome video + Go, then a short health profile form.
 */
export default function WellnessGoLanding({ onBack, onEnter }: Props) {
  const [phase, setPhase] = useState<"hero" | "profile">("hero");
  const [figure, setFigure] = useState<WellnessFigure>("woman");
  const [skinTone, setSkinTone] = useState<WellnessSkinTone>("medium");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);

  const finish = () => {
    const next = updateWellnessProfile({
      ...DEFAULT_HEALTH_PROFILE,
      figure,
      skinTone,
      age: age ? Number(age) : undefined,
      weightLbs: weight ? Number(weight) : undefined,
      onboarded: true,
    });
    onEnter(next);
  };

  if (phase === "profile") {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[#0f1c18] pb-28 text-emerald-50">
        <header className="flex items-center gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setPhase("hero")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/80">
              Quick setup
            </p>
            <h1 className="text-lg font-black">About you</h1>
          </div>
        </header>

        <div className="space-y-5 px-4 pt-2">
          <p className="text-sm leading-relaxed text-emerald-100/75">
            A few basics help YAJ tailor stretch guides, exercise goals, and habit tips. You can change
            this anytime in the dashboard.
          </p>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-200/80">I am a</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "woman" as const, label: "Woman" },
                  { id: "man" as const, label: "Man" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFigure(opt.id)}
                  className={`rounded-2xl border px-3 py-4 text-sm font-black ${
                    figure === opt.id
                      ? "border-teal-300 bg-teal-400/20 text-teal-50"
                      : "border-white/15 bg-white/5 text-emerald-100/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-emerald-100/50">
              Used for your YAJ Wellness Coach look and coaching tips.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-200/80">
              Coach skin tone
            </p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {WELLNESS_SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setSkinTone(tone.id)}
                  aria-label={tone.label}
                  title={tone.label}
                  className={`h-10 w-10 rounded-full border-2 ${
                    skinTone === tone.id
                      ? "border-teal-300 ring-2 ring-teal-300/40"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: tone.swatch }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-emerald-100/70">
              Age
              <input
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-teal-300"
              />
            </label>
            <label className="block text-xs font-semibold text-emerald-100/70">
              Weight (lbs)
              <input
                type="number"
                min={60}
                max={500}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-teal-300"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={finish}
            className="h-14 w-full rounded-full bg-teal-400 text-base font-black text-teal-950 shadow-[0_12px_40px_-12px_rgba(45,212,191,0.65)]"
          >
            Enter Wellness
          </button>
          <button
            type="button"
            onClick={finish}
            className="w-full text-center text-xs font-semibold text-emerald-100/50"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1411] text-white">
      {!videoFailed ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={LANDING_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#2dd4bf55,transparent_50%),radial-gradient(ellipse_at_70%_80%,#0f766e88,transparent_55%),linear-gradient(180deg,#0f1c18,#052e2b)]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75" />

      <header className="relative z-10 flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur"
          aria-label="Back to Explore"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 pb-28 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-200/90">YAJ Wellness</p>
        <h1 className="mt-3 max-w-sm text-4xl font-black leading-tight tracking-tight drop-shadow-md">
          Feel better, one small step at a time
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/80">
          Sleep, move, relax, and build gentle habits — with YAJ guiding you out loud.
        </p>

        <button
          type="button"
          onClick={() => setPhase("profile")}
          className="mt-10 flex h-20 w-20 items-center justify-center rounded-full bg-teal-400 text-xl font-black uppercase tracking-wide text-teal-950 shadow-[0_0_0_12px_rgba(45,212,191,0.22),0_20px_50px_-10px_rgba(0,0,0,0.55)] transition active:scale-95"
        >
          Go
        </button>
        <p className="mt-4 text-[11px] font-medium text-white/60">Tap Go to set up & enter</p>
      </div>
    </div>
  );
}
