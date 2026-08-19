import { useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Shield, Volume2, VolumeX, Wind, X, Zap } from "lucide-react";
import type { Appearance } from "@/lib/boxing";
import { Guard, MoveDir, PUNCHES, Punch } from "@/lib/boxing-live";
import FighterArt, { SKIN_TONES, type FighterAnim } from "./FighterArt";

export { SKIN_TONES };
export { CHARACTERS, characterFor } from "./FighterArt";

function ImpactSpark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} className="bx-spark">
      <path d="M0,-22 L6,-6 L22,0 L6,6 L0,22 L-6,6 L-22,0 L-6,-6 Z" fill="#fff" />
    </g>
  );
}

function StatBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "health" | "stamina" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const gradient =
    tone === "health"
      ? pct > 50
        ? "linear-gradient(90deg, #22c55e, #4ade80)"
        : pct > 22
          ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
          : "linear-gradient(90deg, #ef4444, #f87171)"
      : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.65))";
  return (
    <div className="w-full">
      <div className="mb-0.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wide text-white/50">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  );
}

/** Round action button with a sweeping cooldown veil — no turns, just recovery time. */
function ActionButton({
  label,
  hint,
  Icon,
  onPress,
  tone,
  cooldown,
  disabled,
}: {
  label: string;
  hint: string;
  Icon: typeof Zap;
  onPress: () => void;
  tone: "attack" | "defend";
  cooldown: number;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      className="relative flex h-16 w-16 select-none flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-2 text-white shadow-lg active:scale-90 disabled:opacity-45"
      style={{
        borderColor: tone === "attack" ? "#f59e0b" : "hsl(204 100% 55%)",
        background:
          tone === "attack"
            ? "radial-gradient(circle at 35% 30%, #7a3f10, #2a1608)"
            : "radial-gradient(circle at 35% 30%, hsl(210 60% 22%), hsl(220 55% 8%))",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[8px] font-black uppercase leading-none">{label}</span>
      <span className="text-[6px] font-bold leading-none text-white/50">{hint}</span>
      {cooldown > 0 && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65" style={{ height: `${cooldown * 100}%` }} />
      )}
    </button>
  );
}

function MoveButton({ dir, onPress, disabled }: { dir: MoveDir; onPress: () => void; disabled: boolean }) {
  const Icon = dir === "in" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      aria-label={dir === "in" ? "Step in" : "Step back"}
      className="flex h-11 w-11 select-none items-center justify-center rounded-full border border-white/20 bg-black/55 text-white active:scale-90"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export default function BoxingRing({
  myName,
  myAppearance,
  myHealth,
  myStamina,
  myAdvance,
  oppName,
  oppAppearance,
  isComputer,
  oppHealth,
  oppStamina,
  oppAdvance,
  myAccent,
  oppAccent,

  myAnim,
  oppAnim,
  impact,
  gap,
  cooldowns,
  guardCooldown,
  secondsLeft,
  message,
  interactive,
  finished,
  winnerIsMe,
  statusLabel,
  muted,
  onToggleMute,
  onBack,
  onCustomize,
  onPunch,
  onGuard,
  onMove,
}: {
  myName: string;
  myAppearance: Appearance;
  myHealth: number;
  myStamina: number;
  myAdvance: number;
  oppName: string;
  oppAppearance: Appearance;
  isComputer: boolean;
  oppHealth: number;
  oppStamina: number;
  oppAdvance: number;
  /** Colour that identifies each fighter by seat, so both phones agree who is who. */
  myAccent: string;
  oppAccent: string;

  myAnim: FighterAnim;
  oppAnim: FighterAnim;
  impact: { side: "me" | "opp"; nonce: number } | null;
  gap: number;
  cooldowns: Record<Punch, number>;
  guardCooldown: number;
  secondsLeft: number;
  message: string | null;
  interactive: boolean;
  finished: boolean;
  winnerIsMe: boolean | null;
  statusLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCustomize: () => void;
  onPunch: (p: Punch) => void;
  onGuard: (g: Guard) => void;
  onMove: (dir: MoveDir) => void;
}) {
  const [shake, setShake] = useState(false);
  const [spark, setSpark] = useState<{ x: number; y: number } | null>(null);
  const seen = useRef(0);

  useEffect(() => {
    if (!impact || impact.nonce === seen.current) return;
    seen.current = impact.nonce;
    setSpark({ x: impact.side === "opp" ? 470 : 430, y: 232 });
    setShake(true);
    const a = window.setTimeout(() => setShake(false), 200);
    const b = window.setTimeout(() => setSpark(null), 220);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [impact?.nonce]);

  const canAct = interactive && !finished;
  const inRange = gap <= PUNCHES.jab.reach + 62;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(210 45% 16%) 0%, hsl(220 45% 9%) 45%, hsl(226 45% 5%) 100%)",
        paddingLeft: "max(0.4rem, env(safe-area-inset-left))",
        paddingRight: "max(0.4rem, env(safe-area-inset-right))",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <style>{`
        @keyframes bx-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes bx-spark-pop { 0% { transform: scale(0.3); opacity: 0; } 35% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes bx-foot { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        .bx-shaking { animation: bx-shake 200ms ease-in-out; }
        .bx-spark { animation: bx-spark-pop 220ms ease-out; transform-origin: center; }
        .bx-footwork { animation: bx-foot 900ms ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" className={`block h-full w-full ${shake ? "bx-shaking" : ""}`}>
        <defs>
          <radialGradient id="bx-mat" cx="50%" cy="26%" r="90%">
            <stop offset="0%" stopColor="hsl(220 45% 15%)" />
            <stop offset="55%" stopColor="hsl(224 48% 9%)" />
            <stop offset="100%" stopColor="hsl(226 50% 5%)" />
          </radialGradient>
          <radialGradient id="bx-glove-sheen" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
          </radialGradient>
          <radialGradient id="bx-spot" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="hsl(204 100% 60% / 0.16)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="bx-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(214 55% 20%)" />
            <stop offset="100%" stopColor="hsl(220 50% 11%)" />
          </linearGradient>
        </defs>
        <rect width="900" height="420" fill="url(#bx-mat)" />
        <ellipse cx="450" cy="80" rx="500" ry="220" fill="url(#bx-spot)" />

        {/* Crowd */}
        <rect x="0" y="0" width="900" height="52" fill="hsl(224 48% 7%)" />
        <g>
          {Array.from({ length: 52 }).map((_, i) => {
            const row = i % 2;
            const x = 2 + (i - row) * 17.8 + row * 9;
            const y = row === 0 ? 40 : 26;
            const shirt = ["#3a3f52", "#4a2f3a", "#2f4a3f", "#4a3f2f", "#3f3f4a"][i % 5];
            return (
              <g key={i} opacity={0.55 + ((i * 7) % 4) * 0.08}>
                <ellipse cx={x} cy={y + 8} rx="8" ry="6" fill={shirt} />
                <circle cx={x} cy={y} r="4.4" fill="#1d1420" />
              </g>
            );
          })}
        </g>
        <rect x="0" y="0" width="900" height="12" fill="url(#bx-mat)" opacity="0.5" />

        {/* Ring floor */}
        <path d="M 96 148 L 804 148 L 862 388 L 38 388 Z" fill="url(#bx-floor)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <path d="M 96 148 L 804 148 L 862 388 L 38 388 Z" fill="none" stroke="hsl(204 100% 55% / 0.35)" strokeWidth="5" />
        <ellipse cx="450" cy="270" rx="230" ry="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <text x="450" y="360" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="30" letterSpacing="6" fill="rgba(255,255,255,0.06)">
          YAJ BOXING
        </text>

        {/* Ropes */}
        {[
          { y: 66, sag: 5, c: "#e9e4d8" },
          { y: 96, sag: 6, c: "hsl(204 100% 55%)" },
          { y: 126, sag: 7, c: "#e0453f" },
        ].map((r) => (
          <path key={r.y} d={`M 44 ${r.y} Q 450 ${r.y + r.sag} 856 ${r.y}`} fill="none" stroke={r.c} strokeOpacity="0.9" strokeWidth="4" strokeLinecap="round" />
        ))}
        {[42, 858].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="52" width="16" height="108" rx="4" fill="#2a1810" stroke="rgba(0,0,0,0.4)" />
            <rect x={x - 12} y="58" width="24" height="18" rx="5" fill="hsl(204 100% 45%)" opacity="0.85" />
            <rect x={x - 12} y="82" width="24" height="18" rx="5" fill="#e0453f" opacity="0.65" />
          </g>
        ))}

        <FighterArt side="left" appearance={myAppearance} accent={myAccent} anim={myAnim} advance={myAdvance} />
        <FighterArt side="right" appearance={oppAppearance} accent={oppAccent} anim={oppAnim} advance={oppAdvance} />

        {spark && <ImpactSpark x={spark.x} y={spark.y} />}
      </svg>

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <X className="h-4 w-4" />
          </button>
          <div className="w-32 rounded-xl bg-black/45 p-1.5">
            <p className="mb-1 flex items-center gap-1 truncate text-[10px] font-black text-white">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: myAccent }} />
              {myName}
            </p>

            <StatBar label="HP" value={myHealth} max={100} tone="health" />
            <div className="mt-1">
              <StatBar label="STA" value={myStamina} max={100} tone="stamina" />
            </div>
          </div>
        </div>
        <div className="mt-0.5 flex flex-col items-center gap-1">
          <span className="rounded-full bg-black/60 px-3 py-0.5 font-mono text-[11px] font-black tabular-nums text-white">{clock}</span>
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/80">{statusLabel}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="w-32 rounded-xl bg-black/45 p-1.5 text-right">
            <p className="mb-1 flex items-center justify-end gap-1 truncate text-[10px] font-black text-white">
              {isComputer && <Bot className="h-3 w-3 text-primary" />} {oppName}
            </p>
            <StatBar label="HP" value={oppHealth} max={100} tone="health" />
            <div className="mt-1">
              <StatBar label="STA" value={oppStamina} max={100} tone="stamina" />
            </div>
          </div>
          <button type="button" onClick={onCustomize} aria-label="Customize fighter" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <span className="block h-4 w-4 rounded-full" style={{ background: myAppearance.skin }} />
          </button>
          <button type="button" onClick={onToggleMute} aria-label="Mute" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Punches — left rail, fire freely on their own cooldowns */}
      <div className="pointer-events-none absolute inset-y-0 left-2 z-30 flex flex-col items-center justify-center gap-3">
        {(["jab", "hook", "uppercut"] as Punch[]).map((p) => (
          <div key={p} className="pointer-events-auto">
            <ActionButton
              label={p}
              hint={`${PUNCHES[p].cost} stam`}
              Icon={Zap}
              tone="attack"
              cooldown={cooldowns[p]}
              disabled={!canAct}
              onPress={() => onPunch(p)}
            />
          </div>
        ))}
        <div className="pointer-events-auto mt-1 flex gap-2">
          <MoveButton dir="out" onPress={() => onMove("out")} disabled={!canAct} />
          <MoveButton dir="in" onPress={() => onMove("in")} disabled={!canAct} />
        </div>
      </div>

      {/* Guards — right rail */}
      <div className="pointer-events-none absolute inset-y-0 right-2 z-30 flex flex-col items-center justify-center gap-3">
        <div className="pointer-events-auto">
          <ActionButton label="block" hint="guard" Icon={Shield} tone="defend" cooldown={guardCooldown} disabled={!canAct} onPress={() => onGuard("block")} />
        </div>
        <div className="pointer-events-auto">
          <ActionButton label="dodge" hint="evade" Icon={Wind} tone="defend" cooldown={guardCooldown} disabled={!canAct} onPress={() => onGuard("dodge")} />
        </div>
      </div>

      {/* Range + last-event ticker */}
      {!finished && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1">
          {canAct && !inRange && <span className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] font-black uppercase text-amber-300">Step in to reach</span>}
          {message && <span className="max-w-[70%] truncate rounded-full bg-black/55 px-3 py-0.5 text-[10px] font-bold text-white/85">{message}</span>}
        </div>
      )}
    </div>
  );
}
