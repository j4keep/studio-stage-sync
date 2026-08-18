import { Play, Volume2, VolumeX, X } from "lucide-react";

type Props = {
  open: boolean;
  subtitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onBack: () => void;
};

/** Pre-game splash for 8-ball pool — a billiards-hall scene with restrained purple/blue neon accents. */
export default function PoolIntro({ open, subtitle, muted, onToggleMute, onStart, onBack }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden animate-fade-in bg-[#07070c]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 900 420"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="pi-room" cx="42%" cy="10%" r="95%">
            <stop offset="0%" stopColor="#211430" />
            <stop offset="45%" stopColor="#120c1a" />
            <stop offset="100%" stopColor="#050308" />
          </radialGradient>
          <radialGradient id="pi-lamp" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="hsl(38 90% 75% / 0.5)" />
            <stop offset="45%" stopColor="hsl(38 80% 60% / 0.14)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="pi-felt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#146083" />
            <stop offset="100%" stopColor="#062f45" />
          </linearGradient>
          <linearGradient id="pi-rail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a2f1a" />
            <stop offset="100%" stopColor="#170e08" />
          </linearGradient>
          <radialGradient id="pi-ballgloss" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
        </defs>

        <rect width="900" height="420" fill="url(#pi-room)" />

        {/* Purple rim-light along the left edge, like the reference's ambient room lighting. */}
        <rect x="0" y="0" width="260" height="420" fill="hsl(275 70% 45% / 0.12)" />
        <ellipse cx="20" cy="210" rx="140" ry="260" fill="hsl(275 75% 55% / 0.16)" />

        {/* Hanging lamp + warm light cone over the table. */}
        <line x1="560" y1="0" x2="560" y2="42" stroke="#2a2430" strokeWidth="3" />
        <ellipse cx="560" cy="50" rx="46" ry="10" fill="#1a1620" />
        <ellipse cx="560" cy="49" rx="40" ry="7" fill="#3a3040" />
        <ellipse cx="480" cy="230" rx="420" ry="230" fill="url(#pi-lamp)" />

        {/* YAJ neon sign on the back wall. */}
        <g>
          <path d="M 690 46 l 8 -14 l 8 14 l -6 0 l 0 8 l -4 0 l 0 -8 Z" fill="hsl(275 85% 68%)" opacity="0.9" />
          <rect x="655" y="58" width="90" height="34" rx="8" fill="none" stroke="hsl(275 85% 68%)" strokeWidth="2.5" opacity="0.85" />
          <text x="700" y="82" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="20" fill="hsl(275 85% 72%)" opacity="0.95">
            YAJ
          </text>
        </g>
        <g opacity="0.35" filter="blur(6px)">
          <rect x="655" y="58" width="90" height="34" rx="8" fill="none" stroke="hsl(275 85% 68%)" strokeWidth="6" />
        </g>

        {/* Ambient bokeh */}
        <g opacity="0.4">
          <circle cx="830" cy="70" r="14" fill="hsl(275 80% 65%)" opacity="0.18" />
          <circle cx="120" cy="90" r="10" fill="hsl(204 100% 60%)" opacity="0.16" />
        </g>

        {/* Pool table, 3/4 perspective. */}
        <g>
          <path d="M 150 150 L 745 150 L 668 400 L 224 400 Z" fill="url(#pi-rail)" />
          <path d="M 176 167 L 719 167 L 655 384 L 236 384 Z" fill="url(#pi-felt)" />
          <path d="M 176 167 L 719 167 L 655 384 L 236 384 Z" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

          {/* Faint crown watermark on the felt. */}
          <g opacity="0.14" transform="translate(447,270)">
            <path d="M -30 10 L -20 -14 L -8 4 L 0 -20 L 8 4 L 20 -14 L 30 10 Z" fill="#fff" />
          </g>

          {/* pockets */}
          <circle cx="180" cy="169" r="11" fill="#000" />
          <circle cx="715" cy="169" r="11" fill="#000" />
          <circle cx="447" cy="163" r="9" fill="#000" />
          <circle cx="242" cy="382" r="13" fill="#000" />
          <circle cx="653" cy="382" r="13" fill="#000" />
          <circle cx="447" cy="387" r="11" fill="#000" />

          {/* rack of balls, off-center left */}
          <g>
            <circle cx="330" cy="290" r="15" fill="#e9c336" /><circle cx="330" cy="290" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="360" cy="275" r="15" fill="#f5f2ea" /><rect x="345" y="268" width="30" height="14" fill="#1f5fd6" /><circle cx="360" cy="275" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="360" cy="305" r="15" fill="#d92b2b" /><circle cx="360" cy="305" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="260" r="15" fill="#161616" /><circle cx="390" cy="260" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="290" r="15" fill="#7b3fbf" /><circle cx="390" cy="290" r="15" fill="url(#pi-ballgloss)" />
            <circle cx="390" cy="320" r="15" fill="#e8791c" /><circle cx="390" cy="320" r="15" fill="url(#pi-ballgloss)" />
          </g>

          {/* cue ball + stick, extending off toward the top-right corner like a real shot setup */}
          <circle cx="590" cy="245" r="15" fill="#f5f2ea" />
          <circle cx="590" cy="245" r="15" fill="url(#pi-ballgloss)" />
        </g>
        <g strokeLinecap="round">
          <line x1="900" y1="120" x2="606" y2="234" stroke="#c99a5e" strokeWidth="6" />
          <line x1="900" y1="120" x2="770" y2="170" stroke="#6b4526" strokeWidth="6" />
          <line x1="622" y1="228" x2="606" y2="234" stroke="#2a2430" strokeWidth="6" />
        </g>

        {/* Foreground vignette */}
        <rect width="900" height="420" fill="url(#pi-room)" opacity="0.18" />
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{ background: "linear-gradient(0deg, rgba(5,3,8,0.96) 0%, rgba(5,3,8,0.5) 55%, transparent 100%)" }}
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
        <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "hsl(275 85% 72%)" }}>
          YAJ Billiards Room
        </p>
        <h2 className="mt-1 text-3xl font-black leading-none text-white drop-shadow-lg">8-Ball Pool</h2>
        <p className="mt-1 text-xs font-bold text-white/75">{subtitle}</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex items-center gap-2 rounded-full px-7 py-3 text-sm font-black text-white active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(275 75% 55%), hsl(255 80% 50%))",
            boxShadow: "0 0 26px hsl(275 80% 55% / 0.6), 0 6px 14px rgba(0,0,0,0.5)",
          }}
        >
          <Play className="h-4 w-4" /> Break the rack
        </button>
        <p className="mt-1.5 text-[10px] font-bold italic text-white/45">Break and run!</p>
      </div>
    </div>
  );
}
