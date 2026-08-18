import { Play, Volume2, VolumeX, X } from "lucide-react";
import hostess from "@/assets/games/domino-hostess.jpg";

type Props = {
  open: boolean;
  subtitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onBack: () => void;
};

/** Casino-style pre-game splash with the house dealer and a big Play button. */
export default function DominoIntro({ open, subtitle, muted, onToggleMute, onStart, onBack }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden animate-fade-in">
      <img
        src={hostess}
        alt="Dominoes house dealer at the felt table"
        width={1280}
        height={832}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 70% at 30% 40%, transparent 0%, rgba(10,6,20,0.55) 60%, rgba(8,5,16,0.92) 100%)",
        }}
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

      <div className="absolute bottom-6 left-6 max-w-[60%] animate-scale-in">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f0d78c]">YAJ Casino Lounge</p>
        <h2 className="mt-1 text-3xl font-black leading-none text-white drop-shadow-lg">Dominoes</h2>
        <p className="mt-1 text-xs font-bold text-white/75">{subtitle}</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex items-center gap-2 rounded-full px-7 py-3 text-sm font-black text-[#2a1c05] active:scale-95"
          style={{
            background: "linear-gradient(180deg, #f8e6a8, #d3a52f)",
            boxShadow: "0 0 26px rgba(240,215,140,0.55), 0 6px 14px rgba(0,0,0,0.5)",
          }}
        >
          <Play className="h-4 w-4" /> Take a seat
        </button>
      </div>
    </div>
  );
}
