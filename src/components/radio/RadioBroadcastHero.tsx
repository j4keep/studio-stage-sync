import { Headphones, Mic2, RadioTower, Sparkles } from "lucide-react";
import radioHero from "@/assets/wstudio-orbit-vocalist.jpg";
import mixerHero from "@/assets/wstudio-orbit-mixer.jpg";

export default function RadioBroadcastHero({
  liveCount,
  upcomingCount,
  onBrowse,
  onCreate,
  onGoLive,
}: {
  liveCount: number;
  upcomingCount: number;
  onBrowse: () => void;
  onCreate: () => void;
  onGoLive: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1020] text-white shadow-2xl">
      <div className="absolute inset-0">
        <img src={radioHero} alt="" className="h-full w-full object-cover object-center opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090b12] via-[#090b12]/90 to-[#090b12]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-transparent to-transparent" />
      </div>

      <div className="relative z-10 grid gap-5 p-5 sm:grid-cols-[1fr_180px] sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> On Air
            </span>
            <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/75">
              Creator Radio Network
            </span>
          </div>

          <h2 className="mt-4 max-w-xl text-3xl font-black leading-[0.95] tracking-tight sm:text-4xl">Your voice. Your station. Your audience.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            Tune into live shows, discover creator-run stations, or launch your own broadcast network with music, podcasts and talk programming.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={onBrowse} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-slate-950">
              <Headphones className="h-4 w-4" /> Browse Live
            </button>
            <button onClick={onCreate} className="flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-xs font-black text-white">
              <RadioTower className="h-4 w-4" /> Create Station
            </button>
            <button onClick={onGoLive} className="flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-4 py-2.5 text-xs font-black text-white backdrop-blur">
              <Mic2 className="h-4 w-4" /> Go Live
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Metric label="Live now" value={liveCount} />
            <Metric label="Upcoming" value={upcomingCount} />
            <Metric label="Format" value="24/7" />
          </div>
        </div>

        <div className="relative hidden sm:block">
          <div className="absolute right-0 top-2 h-36 w-32 rotate-3 overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
            <img src={mixerHero} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-2 right-8 rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur">
            <Sparkles className="h-5 w-5 text-cyan-200" />
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Built for creators</p>
            <p className="mt-1 text-xs font-bold">Talk · Music · Podcast · Live</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/45">{label}</p>
      <p className="mt-0.5 text-sm font-black">{value}</p>
    </div>
  );
}
