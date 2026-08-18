import { Play, Volume2, VolumeX, X } from "lucide-react";

type Props = {
  open: boolean;
  subtitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onBack: () => void;
};

/** Pre-game splash for 8-ball pool — a stylized billiards-hall scene, dark + electric-blue. */
export default function PoolIntro({ open, subtitle, muted, onToggleMute, onStart, onBack }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden animate-fade-in bg-[#070c14]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="pi-room" cx="50%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#132436" />
            <stop offset="55%" stopColor="#0b1620" />
            <stop offset="100%" stopColor="#04070c" />
          </radialGradient>
          <radialGradient id="pi-lamp" cx="50%" cy="0%" r="60%">
            <stop offset="0%" stopColor="hsl(204 100% 65% / 0.55)" />
            <stop offset="45%" stopColor="hsl(204 100% 50% / 0.16)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="pi-felt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#146083" />
            <stop offset="100%" stopColor="#062f45" />
          </linearGradient>
          <linearGradient id="pi-rail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2416" />
            <stop offset="100%" stopColor="#150c07" />
          </linearGradient>
          <radialGradient id="pi-ballgloss" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
          <linearGradient id="pi-figure" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2634" />
            <stop offset="100%" stopColor="#060a10" />
          </linearGradient>
        </defs>

        <rect width="600" height="900" fill="url(#pi-room)" />

        {/* Ambient bokeh */}
        <g opacity="0.35">
          <circle cx="80" cy="140" r="26" fill="hsl(204 100% 60%)" opacity="0.18" />
          <circle cx="520" cy="200" r="18" fill="hsl(204 100% 60%)" opacity="0.14" />
          <circle cx="470" cy="110" r="10" fill="#f0d78c" opacity="0.2" />
          <circle cx="60" cy="260" r="8" fill="#f0d78c" opacity="0.16" />
        </g>

        {/* Hanging lamp + light cone */}
        <line x1="300" y1="0" x2="300" y2="150" stroke="#2a3644" strokeWidth="3" />
        <rect x="270" y="150" width="60" height="16" rx="4" fill="#1a2028" />
        <ellipse cx="300" cy="520" rx="340" ry="380" fill="url(#pi-lamp)" />
        <circle cx="300" cy="164" r="7" fill="hsl(204 100% 70%)" />

        {/* Pool table, 3/4 perspective */}
        <g>
          <path d="M 40 560 L 560 560 L 480 780 L 120 780 Z" fill="url(#pi-rail)" />
          <path d="M 68 578 L 532 578 L 466 762 L 134 762 Z" fill="url(#pi-felt)" />
          <path
            d="M 68 578 L 532 578 L 466 762 L 134 762 Z"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />
          {/* pockets */}
          <circle cx="72" cy="580" r="12" fill="#000" />
          <circle cx="528" cy="580" r="12" fill="#000" />
          <circle cx="300" cy="576" r="10" fill="#000" />
          <circle cx="140" cy="758" r="13" fill="#000" />
          <circle cx="460" cy="758" r="13" fill="#000" />
          <circle cx="300" cy="764" r="11" fill="#000" />

          {/* rack of balls */}
          <g>
            <circle cx="330" cy="660" r="15" fill="#e9c336" /><circle cx="330" cy="660" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="360" cy="645" r="15" fill="#f5f2ea" /><rect x="345" y="638" width="30" height="14" fill="#1f5fd6" /><circle cx="360" cy="645" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="360" cy="675" r="15" fill="#d92b2b" /><circle cx="360" cy="675" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="630" r="15" fill="#7b3fbf" /><circle cx="390" cy="630" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="660" r="15" fill="#161616" /><circle cx="390" cy="660" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="690" r="15" fill="#e8791c" /><circle cx="390" cy="690" r="15" fill="url(#pi-ballgloss)" />
          </g>
          {/* cue ball */}
          <circle cx="220" cy="700" r="15" fill="#f5f2ea" />
          <circle cx="220" cy="700" r="15" fill="url(#pi-ballgloss)" />
        </g>

        {/* Player silhouettes */}
        <g fill="url(#pi-figure)" stroke="hsl(204 100% 60% / 0.4)" strokeWidth="1.5">
          {/* left player, leaning in to take the shot */}
          <path d="M 70 900 L 70 750 Q 70 690 115 668 L 185 638 Q 208 628 222 643 L 236 660 Q 185 678 165 718 L 158 900 Z" />
          <circle cx="132" cy="643" r="24" />
          {/* cue stick */}
          <line x1="236" y1="660" x2="335" y2="700" stroke="#c99a5e" strokeWidth="5" strokeLinecap="round" />
          <line x1="236" y1="660" x2="185" y2="648" stroke="hsl(204 100% 55%)" strokeWidth="3" strokeLinecap="round" />

          {/* right player, standing and watching */}
          <path d="M 530 900 L 530 700 Q 528 640 480 630 L 432 630 Q 407 632 402 660 L 407 900 Z" />
          <circle cx="465" cy="612" r="23" />
        </g>

        {/* Foreground vignette */}
        <rect width="600" height="900" fill="url(#pi-room)" opacity="0.15" />
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: "linear-gradient(0deg, rgba(4,7,12,0.96) 0%, rgba(4,7,12,0.55) 45%, transparent 100%)" }}
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
        aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
        className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white active:scale-95"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute bottom-6 left-6 max-w-[75%] animate-scale-in">
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
