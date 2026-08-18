import { Play, Volume2, VolumeX, X } from "lucide-react";
import { BALL_COLORS } from "@/lib/pool";

type Props = {
  open: boolean;
  subtitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onBack: () => void;
};

const RACK_PREVIEW = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12];

/** Pre-game splash for 8-ball pool — matches the dark + electric-blue casino look. */
export default function PoolIntro({ open, subtitle, muted, onToggleMute, onStart, onBack }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden animate-fade-in">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 70% at 30% 25%, hsl(204 90% 22%) 0%, hsl(220 55% 10%) 55%, hsl(226 55% 5%) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(60% 40% at 75% 75%, hsl(var(--primary) / 0.35), transparent 70%)" }}
      />

      <button
        type="button"
        onClick={onBack}
        aria-label="Leave table"
        className="absolute left-3 top-3 rounded-full bg-black/50 p-2 text-white active:scale-95"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white active:scale-95"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 gap-1.5 sm:flex">
        {RACK_PREVIEW.map((id, i) => (
          <span
            key={i}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-[10px] font-black text-[#111] shadow-lg"
            style={{
              background: id > 8 ? `linear-gradient(90deg, ${BALL_COLORS[id]} 30%, #f5f2ea 30% 70%, ${BALL_COLORS[id]} 70%)` : BALL_COLORS[id],
              color: id === 8 || id <= 7 ? "#f5f2ea" : "#111",
              marginTop: i % 2 === 0 ? 0 : 18,
            }}
          >
            {id}
          </span>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 max-w-[70%] animate-scale-in">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">YAJ Billiards Room</p>
        <h2 className="mt-1 text-3xl font-black leading-none text-white drop-shadow-lg">8-Ball Pool</h2>
        <p className="mt-1 text-xs font-bold text-white/75">{subtitle}</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-black text-primary-foreground active:scale-95"
          style={{ boxShadow: "0 0 26px hsl(var(--primary) / 0.55), 0 6px 14px rgba(0,0,0,0.5)" }}
        >
          <Play className="h-4 w-4" /> Break the rack
        </button>
      </div>
    </div>
  );
}
