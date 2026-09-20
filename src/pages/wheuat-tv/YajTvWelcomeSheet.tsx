import yajLogo from "@/assets/yaj-logo.png";
import welcomeBg from "@/assets/yajtv-welcome-bg.png";

const SEEN_KEY = "yaj-tv-welcome-seen";

export function hasSeenYajTvWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markYajTvWelcomeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode / storage blocked — just won't stick between sessions */
  }
}

export function YajTvWelcomeSheet({ onEnter }: { onEnter: () => void }) {
  const handleEnter = () => {
    markYajTvWelcomeSeen();
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end overflow-hidden bg-black text-white">
      <img src={welcomeBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* Brand-colored wash over the art — violet/pink/teal, matching the YAJ logo palette. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(15,7,30,0.55) 45%, #05030a 92%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          background:
            "radial-gradient(circle at 15% 15%, #7c3aedcc, transparent 45%), radial-gradient(circle at 85% 30%, #ec4899cc, transparent 45%), radial-gradient(circle at 50% 90%, #14b8a6cc, transparent 50%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))] text-center">
        <img src={yajLogo} alt="YAJ" className="h-16 w-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]" />
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight">
          YAJ<span className="bg-gradient-to-r from-violet-400 via-pink-400 to-teal-300 bg-clip-text text-transparent">.TV</span>
        </h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/75">
          Short films, podcasts, music videos and live shows — made by the creators you already follow.
        </p>

        <button
          onClick={handleEnter}
          className="mt-7 w-full max-w-xs rounded-full bg-white py-3.5 text-sm font-bold text-black shadow-lg shadow-black/40 active:scale-95"
        >
          Enter YAJ.TV
        </button>
      </div>
    </div>
  );
}
