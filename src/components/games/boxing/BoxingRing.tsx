import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bot, HelpCircle, Shield, Volume2, VolumeX, Wind, X, Zap } from "lucide-react";
import { Action, Appearance, LastAction, PUNCH_STATS, PunchType } from "@/lib/boxing";

type FighterAnim = "idle" | "jab" | "hook" | "uppercut" | "guard-block" | "guard-dodge" | "hit" | "ko";

export const SKIN_TONES = ["#e8c39e", "#c58c58", "#8a5a3a", "#5a3826"];
export const BUILD_SCALE: Record<Appearance["build"], number> = { lean: 0.86, athletic: 1, heavy: 1.24 };

/** A proportioned boxer: tapered torso, staggered stance, two-segment arms, gloves, trunks —
 *  not a photoreal or hand-illustrated model, but a real fighter silhouette, not a UI placeholder. */
function Fighter({ side, appearance, accent, anim }: { side: "left" | "right"; appearance: Appearance; accent: string; anim: FighterAnim }) {
  const facing = side === "left" ? 1 : -1;
  const cx = side === "left" ? 235 : 665;
  const skin = appearance.skin;
  const s = BUILD_SCALE[appearance.build];
  const hit = anim === "hit";
  const ko = anim === "ko";
  const guarding = anim === "guard-block" || anim === "guard-dodge";
  const ducking = anim === "guard-dodge";

  const lunge = anim === "jab" ? 30 : anim === "hook" ? 21 : anim === "uppercut" ? 13 : 0;
  const twist = anim === "hook" ? 12 : anim === "uppercut" ? 4 : 0;
  const bob = anim === "uppercut" ? -7 : ducking ? 14 : 0;
  const knockback = hit ? 34 : 0;

  const bodyStyle: CSSProperties = {
    transform: ko
      ? `translate(${facing * 42}px, 46px) rotate(${facing * 92}deg)`
      : `translate(${(lunge - knockback) * facing}px, ${bob}px) rotate(${(twist - (hit ? 9 : 0)) * facing}deg)`,
    transformOrigin: `${cx}px 300px`,
    transition: ko ? "transform 420ms cubic-bezier(.4,0,.2,1)" : "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };
  const leadArmStyle: CSSProperties = {
    transform:
      anim === "jab"
        ? `translate(${40 * facing}px, -7px) rotate(${-6 * facing}deg)`
        : guarding
          ? `translate(${7 * facing}px, -5px) rotate(${-16 * facing}deg)`
          : `rotate(${-10 * facing}deg)`,
    transformOrigin: `${cx + 14 * facing}px 218px`,
    transition: "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };
  const rearArmStyle: CSSProperties = {
    transform:
      anim === "hook"
        ? `translate(${17 * facing}px, -2px) rotate(${58 * facing}deg)`
        : anim === "uppercut"
          ? `translate(${12 * facing}px, -26px) rotate(${20 * facing}deg)`
          : guarding
            ? `translate(${2 * facing}px, -2px) rotate(${-8 * facing}deg)`
            : `rotate(${6 * facing}deg)`,
    transformOrigin: `${cx - 12 * facing}px 222px`,
    transition: "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };

  const torsoTopW = 30 * s;
  const torsoBotW = 20 * s;
  const armW = 12 * s;
  const gloveR = 13 * s;

  const ink = "#12070a";
  const inkW = 2.2 * s;

  return (
    <g style={bodyStyle}>
      <ellipse cx={cx} cy="378" rx={34 * s} ry="8" fill="rgba(0,0,0,0.35)" />
      {/* Legs */}
      <path
        d={`M ${cx - 9} 278 L ${cx - 30} 292 L ${cx - 25} 376 L ${cx - 10} 376 L ${cx - 11} 296 Z`}
        fill="#161b26"
        stroke={ink}
        strokeWidth={inkW}
        strokeLinejoin="round"
      />
      <path
        d={`M ${cx + 7} 278 L ${cx + 30} 296 L ${cx + 24} 376 L ${cx + 9} 376 L ${cx + 5} 296 Z`}
        fill="#1c2431"
        stroke={ink}
        strokeWidth={inkW}
        strokeLinejoin="round"
      />
      <ellipse cx={cx - 23} cy="377" rx="10" ry="5" fill="#0b0e14" stroke={ink} strokeWidth={inkW * 0.8} />
      <ellipse cx={cx + 21} cy="377" rx="10" ry="5" fill="#0b0e14" stroke={ink} strokeWidth={inkW * 0.8} />

      {/* Torso */}
      <path
        d={`M ${cx - torsoTopW} 222 Q ${cx} 210 ${cx + torsoTopW} 222 L ${cx + torsoBotW} 278 Q ${cx} 286 ${cx - torsoBotW} 278 Z`}
        fill={hit ? "#ff6b6b" : skin}
        stroke={ink}
        strokeWidth={inkW}
        strokeLinejoin="round"
        style={{ transition: "fill 100ms" }}
      />
      <path d={`M ${cx - 3} 234 L ${cx - 3} 270 M ${cx + 3} 234 L ${cx + 3} 270`} stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" />
      <path d={`M ${cx - torsoTopW + 4} 226 Q ${cx} 216 ${cx + torsoTopW - 4} 226`} stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none" />
      {/* Trunks */}
      <path
        d={`M ${cx - torsoBotW - 2} 270 L ${cx + torsoBotW + 2} 270 L ${cx + torsoBotW - 4} 292 L ${cx - torsoBotW + 4} 292 Z`}
        fill={accent}
        stroke={ink}
        strokeWidth={inkW}
        strokeLinejoin="round"
      />
      <path d={`M ${cx - torsoBotW - 2} 270 L ${cx + torsoBotW + 2} 270 L ${cx + torsoBotW - 1} 277 L ${cx - torsoBotW + 1} 277 Z`} fill="#0b0e14" opacity="0.32" />

      {/* Rear arm (drawn behind torso) */}
      <g style={rearArmStyle}>
        <path
          d={`M ${cx - 12 * facing} 222 L ${cx - 26 * facing} 244 L ${cx - 21 * facing} 247 L ${cx - 7 * facing} 226 Z`}
          fill={skin}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
        />
        <ellipse cx={cx - 26 * facing} cy="247" rx={gloveR} ry={gloveR * 0.9} fill={accent} stroke={ink} strokeWidth={inkW} />
        <ellipse cx={cx - 26 * facing} cy="247" rx={gloveR} ry={gloveR * 0.9} fill="url(#bx-glove-sheen)" />
      </g>

      {/* Neck + head */}
      <rect x={cx - 6} y="204" width="12" height="14" rx="3" fill={skin} stroke={ink} strokeWidth={inkW * 0.8} />
      <ellipse cx={cx + 3 * facing} cy="192" rx="17" ry="19" fill={skin} stroke={ink} strokeWidth={inkW} />
      {appearance.fem ? (
        <>
          <path
            d={`M ${cx - 14} 186 Q ${cx + 2 * facing} 168 ${cx + 18} 184 Q ${cx + 10} 178 ${cx} 178 Q ${cx - 12} 178 ${cx - 14} 186 Z`}
            fill="#241408"
            stroke={ink}
            strokeWidth={inkW * 0.7}
          />
          <path
            d={`M ${cx - 15 * facing} 196 Q ${cx - 22 * facing} 214 ${cx - 17 * facing} 232 L ${cx - 12 * facing} 230 Q ${cx - 16 * facing} 214 ${cx - 12 * facing} 198 Z`}
            fill="#241408"
            stroke={ink}
            strokeWidth={inkW * 0.7}
          />
        </>
      ) : (
        <path
          d={`M ${cx - 14} 187 Q ${cx + 2 * facing} 172 ${cx + 17} 185 Q ${cx + 9} 180 ${cx} 180 Q ${cx - 11} 180 ${cx - 14} 187 Z`}
          fill="#1c130c"
          stroke={ink}
          strokeWidth={inkW * 0.7}
        />
      )}
      <circle cx={cx + 9 * facing} cy="191" r="2" fill="#161616" />

      {/* Lead arm (drawn in front) */}
      <g style={leadArmStyle}>
        <path
          d={`M ${cx + 14 * facing} 222 L ${cx + 26 * facing} 240 L ${cx + 21 * facing} 244 L ${cx + 9 * facing} 226 Z`}
          fill={skin}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
        />
        <ellipse cx={cx + 26 * facing} cy="242" rx={gloveR + 1} ry={gloveR} fill={accent} stroke={ink} strokeWidth={inkW} />
        <ellipse cx={cx + 26 * facing} cy="242" rx={gloveR + 1} ry={gloveR} fill="url(#bx-glove-sheen)" />
      </g>

      {guarding && (
        <circle cx={cx + 16 * facing} cy="216" r="46" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.55" style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
      )}
      <path d={`M ${cx - armW} 236 h ${armW * 2}`} opacity="0" />
    </g>
  );
}

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
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  );
}

const ATTACK_META: Record<PunchType, { icon: typeof Zap; hint: string }> = {
  jab: { icon: Zap, hint: PUNCH_STATS.jab.cost + " stam" },
  hook: { icon: Zap, hint: PUNCH_STATS.hook.cost + " stam" },
  uppercut: { icon: Zap, hint: PUNCH_STATS.uppercut.cost + " stam" },
};

function SideButton({ label, hint, Icon, onClick, tone }: { label: string; hint: string; Icon: typeof Zap; onClick: () => void; tone: "attack" | "defend" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-white shadow-lg active:scale-90"
      style={{
        borderColor: tone === "attack" ? "#f59e0b" : "hsl(204 100% 55%)",
        background: tone === "attack" ? "radial-gradient(circle at 35% 30%, #7a3f10, #2a1608)" : "radial-gradient(circle at 35% 30%, hsl(210 60% 22%), hsl(220 55% 8%))",
      }}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[8px] font-black uppercase leading-none">{label}</span>
      <span className="text-[6px] font-bold leading-none text-white/50">{hint}</span>
    </button>
  );
}

export default function BoxingRing({
  myName,
  myAppearance,
  myHealth,
  myStamina,
  oppName,
  oppAppearance,
  isComputer,
  oppHealth,
  oppStamina,
  lastAction,
  interactive,
  finished,
  winnerIsMe,
  turnLabel,
  myTurn,
  muted,
  onToggleMute,
  onBack,
  onCustomize,
  onAction,
}: {
  myName: string;
  myAppearance: Appearance;
  myHealth: number;
  myStamina: number;
  oppName: string;
  oppAppearance: Appearance;
  isComputer: boolean;
  oppHealth: number;
  oppStamina: number;
  lastAction: LastAction | null;
  interactive: boolean;
  finished: boolean;
  winnerIsMe: boolean | null;
  turnLabel: string;
  myTurn: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCustomize: () => void;
  onAction: (action: Action) => void;
}) {
  const [myAnim, setMyAnim] = useState<FighterAnim>("idle");
  const [oppAnim, setOppAnim] = useState<FighterAnim>("idle");
  const [shake, setShake] = useState(false);
  const [spark, setSpark] = useState<{ x: number; y: number } | null>(null);
  const seenTurn = useRef<number | null>(null);

  useEffect(() => {
    if (!lastAction || seenTurn.current === lastAction.turn) return;
    seenTurn.current = lastAction.turn;
    const actorIsMe = lastAction.seat === 0;
    const setActor = actorIsMe ? setMyAnim : setOppAnim;
    const setTarget = actorIsMe ? setOppAnim : setMyAnim;

    if (lastAction.action === "block" || lastAction.action === "dodge") {
      setActor(lastAction.action === "block" ? "guard-block" : "guard-dodge");
      const t = window.setTimeout(() => setActor("idle"), 750);
      return () => window.clearTimeout(t);
    }

    setActor(lastAction.action as PunchType);
    const timers: number[] = [];
    if (lastAction.hit) {
      timers.push(
        window.setTimeout(() => {
          setTarget("hit");
          setSpark({ x: actorIsMe ? 560 : 345, y: 236 });
          setShake(true);
          window.setTimeout(() => setShake(false), 220);
          window.setTimeout(() => setSpark(null), 220);
        }, 140),
      );
      timers.push(
        window.setTimeout(() => {
          const koNow = (actorIsMe ? oppHealth : myHealth) <= 0;
          setTarget(koNow ? "ko" : "idle");
        }, 460),
      );
    }
    timers.push(window.setTimeout(() => setActor("idle"), 340));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction?.turn]);

  useEffect(() => {
    if (finished && winnerIsMe === false) setMyAnim("ko");
    if (finished && winnerIsMe === true) setOppAnim("ko");
  }, [finished, winnerIsMe]);

  const canAct = interactive && !finished;

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
        .bx-shaking { animation: bx-shake 220ms ease-in-out; }
        .bx-spark { animation: bx-spark-pop 220ms ease-out; transform-origin: center; }
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

        {/* Crowd, packed into the band the ropes will sit in front of */}
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

        {/* Ring floor / canvas mat, receding toward the viewer — drawn first so ropes sit in front of it */}
        <path d="M 96 148 L 804 148 L 862 388 L 38 388 Z" fill="url(#bx-floor)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <path d="M 96 148 L 804 148 L 862 388 L 38 388 Z" fill="none" stroke="hsl(204 100% 55% / 0.35)" strokeWidth="5" />
        <ellipse cx="450" cy="270" rx="230" ry="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <text x="450" y="360" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="30" letterSpacing="6" fill="rgba(255,255,255,0.06)">
          YAJ BOXING
        </text>

        {/* Ropes — spaced out above the mat, not crowded against its edge */}
        {[
          { y: 66, sag: 5, c: "#e9e4d8" },
          { y: 96, sag: 6, c: "hsl(204 100% 55%)" },
          { y: 126, sag: 7, c: "#e0453f" },
        ].map((r) => (
          <path
            key={r.y}
            d={`M 44 ${r.y} Q 450 ${r.y + r.sag} 856 ${r.y}`}
            fill="none"
            stroke={r.c}
            strokeOpacity="0.9"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        {[42, 858].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="52" width="16" height="108" rx="4" fill="#2a1810" stroke="rgba(0,0,0,0.4)" />
            <rect x={x - 12} y="58" width="24" height="18" rx="5" fill="hsl(204 100% 45%)" opacity="0.85" />
            <rect x={x - 12} y="82" width="24" height="18" rx="5" fill="#e0453f" opacity="0.65" />
          </g>
        ))}

        <Fighter side="left" appearance={myAppearance} accent="hsl(204 100% 55%)" anim={myAnim} />
        <Fighter side="right" appearance={oppAppearance} accent="#f59e0b" anim={oppAnim} />
        {spark && <ImpactSpark x={spark.x} y={spark.y} />}
      </svg>

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <X className="h-4 w-4" />
          </button>
          <div className="w-32 rounded-xl bg-black/45 p-1.5">
            <p className="mb-1 truncate text-[10px] font-black text-white">{myName}</p>
            <StatBar label="HP" value={myHealth} max={100} tone="health" />
            <div className="mt-1">
              <StatBar label="STA" value={myStamina} max={100} tone="stamina" />
            </div>
          </div>
        </div>
        <span
          className="mt-1 shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            background: myTurn ? "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))" : "rgba(0,0,0,0.55)",
            color: myTurn ? "hsl(var(--primary-foreground))" : "rgba(255,255,255,0.85)",
            boxShadow: myTurn ? "0 0 14px hsl(var(--primary) / 0.55)" : undefined,
          }}
        >
          {turnLabel}
        </span>
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

      {/* Side controls */}
      <div className="pointer-events-none absolute inset-y-0 left-2 z-30 flex flex-col items-center justify-center gap-3">
        {(["jab", "hook", "uppercut"] as PunchType[]).map((a) => (
          <div key={a} className="pointer-events-auto" style={{ opacity: canAct ? 1 : 0.4 }}>
            <SideButton label={a} hint={ATTACK_META[a].hint} Icon={ATTACK_META[a].icon} tone="attack" onClick={() => canAct && onAction(a)} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-2 z-30 flex flex-col items-center justify-center gap-3">
        <div className="pointer-events-auto" style={{ opacity: canAct ? 1 : 0.4 }}>
          <SideButton label="block" hint="guard" Icon={Shield} tone="defend" onClick={() => canAct && onAction("block")} />
        </div>
        <div className="pointer-events-auto" style={{ opacity: canAct ? 1 : 0.4 }}>
          <SideButton label="dodge" hint="evade" Icon={Wind} tone="defend" onClick={() => canAct && onAction("dodge")} />
        </div>
      </div>

      {!canAct && !finished && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-20 text-center text-[10px] font-bold text-white/40">
          Waiting on {oppName}…
        </p>
      )}
    </div>
  );
}
