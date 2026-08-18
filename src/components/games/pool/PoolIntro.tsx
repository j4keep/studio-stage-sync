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
        viewBox="0 0 900 420"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="pi-room" cx="50%" cy="12%" r="90%">
            <stop offset="0%" stopColor="#132436" />
            <stop offset="55%" stopColor="#0b1620" />
            <stop offset="100%" stopColor="#04070c" />
          </radialGradient>
          <radialGradient id="pi-lamp" cx="50%" cy="0%" r="75%">
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

        <rect width="900" height="420" fill="url(#pi-room)" />

        {/* Sunburst rays radiating from the lamp */}
        <g opacity="0.55">
          {Array.from({ length: 22 }).map((_, i) => {
            const angle = (i / 22) * Math.PI * 2;
            const len = 480 + (i % 3) * 70;
            const x2 = 450 + Math.cos(angle) * len;
            const y2 = 55 + Math.sin(angle) * len;
            return (
              <line
                key={i}
                x1="450"
                y1="55"
                x2={x2}
                y2={y2}
                stroke="hsl(204 100% 55%)"
                strokeWidth={i % 2 === 0 ? 5 : 2.5}
                opacity={i % 2 === 0 ? 0.11 : 0.065}
              />
            );
          })}
        </g>

        {/* Ambient bokeh */}
        <g opacity="0.35">
          <circle cx="120" cy="60" r="22" fill="hsl(204 100% 60%)" opacity="0.18" />
          <circle cx="800" cy="90" r="16" fill="hsl(204 100% 60%)" opacity="0.14" />
          <circle cx="720" cy="40" r="9" fill="#f0d78c" opacity="0.2" />
          <circle cx="90" cy="120" r="7" fill="#f0d78c" opacity="0.16" />
        </g>

        {/* Hanging lamp + light cone */}
        <line x1="450" y1="0" x2="450" y2="45" stroke="#2a3644" strokeWidth="3" />
        <rect x="422" y="45" width="56" height="15" rx="4" fill="#1a2028" />
        <ellipse cx="450" cy="230" rx="430" ry="230" fill="url(#pi-lamp)" />
        <circle cx="450" cy="58" r="6" fill="hsl(204 100% 70%)" />

        {/* Pool table, 3/4 perspective */}
        <g>
          <path d="M 168 168 L 732 168 L 660 400 L 240 400 Z" fill="url(#pi-rail)" />
          <path d="M 192 184 L 708 184 L 648 384 L 252 384 Z" fill="url(#pi-felt)" />
          <path d="M 192 184 L 708 184 L 648 384 L 252 384 Z" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          {/* pockets */}
          <circle cx="196" cy="186" r="11" fill="#000" />
          <circle cx="704" cy="186" r="11" fill="#000" />
          <circle cx="450" cy="182" r="9" fill="#000" />
          <circle cx="258" cy="382" r="13" fill="#000" />
          <circle cx="642" cy="382" r="13" fill="#000" />
          <circle cx="450" cy="386" r="11" fill="#000" />

          {/* rack of balls */}
          <g>
            <circle cx="480" cy="280" r="14" fill="#e9c336" /><circle cx="480" cy="280" r="14" fill="url(#pi-ballgloss)" />
            <circle cx="508" cy="266" r="14" fill="#f5f2ea" /><rect x="494" y="259" width="28" height="13" fill="#1f5fd6" /><circle cx="508" cy="266" r="14" fill="url(#pi-ballgloss)" />
            <circle cx="508" cy="294" r="14" fill="#d92b2b" /><circle cx="508" cy="294" r="14" fill="url(#pi-ballgloss)" />
            <circle cx="536" cy="252" r="14" fill="#7b3fbf" /><circle cx="536" cy="252" r="14" fill="url(#pi-ballgloss)" />
            <circle cx="536" cy="280" r="14" fill="#161616" /><circle cx="536" cy="280" r="14" fill="url(#pi-ballgloss)" />
            <circle cx="536" cy="308" r="14" fill="#e8791c" /><circle cx="536" cy="308" r="14" fill="url(#pi-ballgloss)" />
          </g>
          {/* cue ball */}
          <circle cx="360" cy="320" r="14" fill="#f5f2ea" />
          <circle cx="360" cy="320" r="14" fill="url(#pi-ballgloss)" />
        </g>

        {/* Player silhouettes, flanking the table on either side */}
        <g fill="url(#pi-figure)" stroke="hsl(204 100% 60% / 0.4)" strokeWidth="1.5">
          {/* left player, leaning in to take the shot */}
          <path d="M 10 420 L 10 330 Q 10 288 46 272 L 108 246 Q 128 238 140 250 L 152 264 Q 108 280 92 312 L 86 420 Z" />
          <circle cx="102" cy="250" r="21" />
          <line x1="152" y1="264" x2="248" y2="300" stroke="#c99a5e" strokeWidth="5" strokeLinecap="round" />
          <line x1="152" y1="264" x2="108" y2="254" stroke="hsl(204 100% 55%)" strokeWidth="3" strokeLinecap="round" />

          {/* right player, standing and watching */}
          <path d="M 890 420 L 890 300 Q 888 254 848 246 L 806 246 Q 784 248 780 272 L 784 420 Z" />
          <circle cx="815" cy="232" r="20" />
        </g>

        {/* Foreground vignette */}
        <rect width="900" height="420" fill="url(#pi-room)" opacity="0.15" />
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{ background: "linear-gradient(0deg, rgba(4,7,12,0.96) 0%, rgba(4,7,12,0.5) 55%, transparent 100%)" }}
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
