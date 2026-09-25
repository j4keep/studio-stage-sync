import { useEffect, useState } from "react";
import { Headphones, Mic2, RadioTower, Sparkles, X } from "lucide-react";
import radioHostImage from "@/assets/wstudio-orbit-headphones.jpg";
import podcastImage from "@/assets/podcast-1.jpg";

const WELCOME_KEY = "yaj-radio-welcome-v2";

export default function RadioWelcomeSheet({
  onCreateStation,
  onStartListening,
}: {
  onCreateStation: () => void;
  onStartListening: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = (action?: () => void) => {
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
    setOpen(false);
    action?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end bg-black/70 backdrop-blur-md sm:items-center sm:justify-center sm:p-5">
      <div className="relative max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-[32px] border border-white/10 bg-[#0a0d16] text-white shadow-2xl [-webkit-overflow-scrolling:touch] sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-2xl sm:rounded-[32px]">
        <button
          type="button"
          onClick={() => close()}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative h-[220px] overflow-hidden sm:h-[330px]">
          <img src={radioHostImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <img
            src={podcastImage}
            alt=""
            className="absolute bottom-4 right-4 h-28 w-28 rounded-2xl border border-white/20 object-cover shadow-2xl sm:h-36 sm:w-36"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d16] via-black/15 to-black/15" />
          <div className="absolute bottom-5 left-5 right-36 sm:right-44">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Broadcast. Live.
            </span>
            <h1 className="mt-3 text-3xl font-black leading-[0.95] tracking-tight sm:text-4xl">Welcome to YAJ Radio</h1>
          </div>
        </div>

        <div className="px-5 pb-[max(6rem,calc(env(safe-area-inset-bottom)+1.5rem))] pt-4 sm:px-7 sm:pb-7">
          <p className="max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            Build your own station, host live shows, broadcast podcasts, program music, and let listeners tune in from anywhere.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Feature icon={<RadioTower className="h-4 w-4" />} title="Own a station" />
            <Feature icon={<Mic2 className="h-4 w-4" />} title="Go live" />
            <Feature icon={<Headphones className="h-4 w-4" />} title="Tune in" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => close(onStartListening)}
              className="rounded-2xl border border-white/15 bg-white/7 px-4 py-3.5 text-sm font-black text-white"
            >
              Start Listening
            </button>
            <button
              type="button"
              onClick={() => close(onCreateStation)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-fuchsia-900/20"
            >
              <Sparkles className="h-4 w-4" /> Create a Station
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-200">{icon}</span>
      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-white/80">{title}</p>
    </div>
  );
}
