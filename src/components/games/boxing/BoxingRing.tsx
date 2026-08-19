import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bot, Shield, Wind, Zap } from "lucide-react";
import { Action, LastAction, PUNCH_STATS, PunchType, Stance } from "@/lib/boxing";

type FighterAnim = "idle" | "jab" | "hook" | "uppercut" | "guard-block" | "guard-dodge" | "hit" | "ko";

/** A proportioned boxer: tapered torso, staggered stance, two-segment arms, gloves, trunks —
 *  not a photoreal 3D model, but reads as an actual fighter instead of a UI placeholder. */
function Fighter({
  side,
  skin,
  accent,
  anim,
}: {
  side: "left" | "right";
  skin: string;
  accent: string;
  anim: FighterAnim;
}) {
  const facing = side === "left" ? 1 : -1;
  const cx = side === "left" ? 98 : 282;
  const hit = anim === "hit";
  const ko = anim === "ko";
  const guarding = anim === "guard-block" || anim === "guard-dodge";
  const ducking = anim === "guard-dodge";

  const lunge = anim === "jab" ? 24 : anim === "hook" ? 17 : anim === "uppercut" ? 11 : 0;
  const twist = anim === "hook" ? 12 : anim === "uppercut" ? 4 : 0;
  const bob = anim === "uppercut" ? -6 : ducking ? 12 : 0;
  const knockback = hit ? 28 : 0;

  const bodyStyle: CSSProperties = {
    transform: ko
      ? `translate(${facing * 34}px, 40px) rotate(${facing * 92}deg)`
      : `translate(${(lunge - knockback) * facing}px, ${bob}px) rotate(${(twist - (hit ? 9 : 0)) * facing}deg)`,
    transformOrigin: `${cx}px 176px`,
    transition: ko ? "transform 380ms cubic-bezier(.4,0,.2,1)" : "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };

  // Lead arm (nearer the opponent) drives the jab; rear arm drives hook/uppercut.
  const leadArmStyle: CSSProperties = {
    transform: anim === "jab"
      ? `translate(${34 * facing}px, -6px) rotate(${-6 * facing}deg)`
      : guarding
        ? `translate(${6 * facing}px, -4px) rotate(${-16 * facing}deg)`
        : `rotate(${-10 * facing}deg)`,
    transformOrigin: `${cx + 12 * facing}px 128px`,
    transition: "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };

  const rearArmStyle: CSSProperties = {
    transform:
      anim === "hook"
        ? `translate(${14 * facing}px, -2px) rotate(${58 * facing}deg)`
        : anim === "uppercut"
          ? `translate(${10 * facing}px, -22px) rotate(${20 * facing}deg)`
          : guarding
            ? `translate(${2 * facing}px, -2px) rotate(${-8 * facing}deg)`
            : `rotate(${6 * facing}deg)`,
    transformOrigin: `${cx - 10 * facing}px 132px`,
    transition: "transform 130ms cubic-bezier(.25,.9,.4,1.1)",
  };

  return (
    <g style={bodyStyle}>
      {/* Shadow */}
      <ellipse cx={cx} cy="212" rx="26" ry="6" fill="rgba(0,0,0,0.35)" />

      {/* Back leg */}
      <path d={`M ${cx - 8} 168 L ${cx - 26} 178 L ${cx - 22} 210 L ${cx - 10} 210 L ${cx - 10} 180 Z`} fill="#161b26" />
      {/* Front leg */}
      <path d={`M ${cx + 6} 168 L ${cx + 24} 182 L ${cx + 20} 210 L ${cx + 8} 210 L ${cx + 4} 182 Z`} fill="#1c2431" />
      {/* Shoes */}
      <ellipse cx={cx - 20} cy="211" rx="9" ry="4.5" fill="#0b0e14" />
      <ellipse cx={cx + 18} cy="211" rx="9" ry="4.5" fill="#0b0e14" />

      {/* Torso (tapered, shoulders wider than waist) */}
      <path
        d={`M ${cx - 24} 122 Q ${cx} 112 ${cx + 24} 122 L ${cx + 16} 168 Q ${cx} 174 ${cx - 16} 168 Z`}
        fill={hit ? "#ff6b6b" : skin === "deep" ? "#5a3c28" : "#b97f4f"}
        style={{ transition: "fill 100ms" }}
      />
      {/* Ab shading */}
      <path d={`M ${cx - 3} 132 L ${cx - 3} 162 M ${cx + 3} 132 L ${cx + 3} 162`} stroke="rgba(0,0,0,0.18)" strokeWidth="1.4" />
      {/* Trunks */}
      <path d={`M ${cx - 17} 160 L ${cx + 17} 160 L ${cx + 13} 176 L ${cx - 13} 176 Z`} fill={accent} />
      <path d={`M ${cx - 17} 160 L ${cx + 17} 160 L ${cx + 15} 166 L ${cx - 15} 166 Z`} fill="#0b0e14" opacity="0.35" />

      {/* Rear arm (behind torso, drawn first) */}
      <g style={rearArmStyle}>
        <path d={`M ${cx - 10 * facing} 122 L ${cx - 22 * facing} 140 L ${cx - 18 * facing} 142 L ${cx - 6 * facing} 126 Z`} fill={skin === "deep" ? "#4c331f" : "#a06f44"} />
        <ellipse cx={cx - 22 * facing} cy="142" rx="10" ry="9" fill={accent} />
        <ellipse cx={cx - 22 * facing} cy="142" rx="10" ry="9" fill="url(#bx-glove-sheen)" />
      </g>

      {/* Neck + head */}
      <rect x={cx - 5} y="108" width="10" height="12" rx="3" fill={skin === "deep" ? "#5a3c28" : "#b97f4f"} />
      <ellipse cx={cx + 3 * facing} cy="98" rx="15" ry="17" fill={skin === "deep" ? "#63432c" : "#c58c58"} />
      <path d={`M ${cx - 12} 92 Q ${cx + 2 * facing} 76 ${cx + 16} 90 Q ${cx + 10} 84 ${cx} 84 Q ${cx - 10} 84 ${cx - 12} 92 Z`} fill="#1c130c" />
      <circle cx={cx + 8 * facing} cy="97" r="1.8" fill="#161616" />

      {/* Lead arm (front, drawn last so it's on top) */}
      <g style={leadArmStyle}>
        <path d={`M ${cx + 12 * facing} 122 L ${cx + 22 * facing} 138 L ${cx + 18 * facing} 141 L ${cx + 8 * facing} 126 Z`} fill={skin === "deep" ? "#5a3c28" : "#b97f4f"} />
        <ellipse cx={cx + 22 * facing} cy="140" rx="11" ry="10" fill={accent} />
        <ellipse cx={cx + 22 * facing} cy="140" rx="11" ry="10" fill="url(#bx-glove-sheen)" />
      </g>

      {guarding && (
        <circle
          cx={cx + 14 * facing}
          cy="118"
          r="30"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          opacity="0.55"
          style={{ filter: "drop-shadow(0 0 6px " + accent + ")" }}
        />
      )}
    </g>
  );
}

function ImpactSpark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} className="bx-spark">
      <path d="M0,-16 L4,-4 L16,0 L4,4 L0,16 L-4,4 L-16,0 L-4,-4 Z" fill="#fff" />
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  );
}

const ACTION_META: Record<Action, { icon: typeof Zap; hint: string }> = {
  jab: { icon: Zap, hint: `${PUNCH_STATS.jab.cost} stam · fast` },
  hook: { icon: Zap, hint: `${PUNCH_STATS.hook.cost} stam` },
  uppercut: { icon: Zap, hint: `${PUNCH_STATS.uppercut.cost} stam · heavy` },
  block: { icon: Shield, hint: "recover + guard" },
  dodge: { icon: Wind, hint: "recover + evade" },
};

export default function BoxingRing({
  myName,
  myAvatar,
  myHealth,
  myStamina,
  myStance,
  oppName,
  oppAvatar,
  isComputer,
  oppHealth,
  oppStamina,
  oppStance,
  lastAction,
  interactive,
  finished,
  winnerIsMe,
  onAction,
}: {
  myName: string;
  myAvatar?: string | null;
  myHealth: number;
  myStamina: number;
  myStance: Stance;
  oppName: string;
  oppAvatar?: string | null;
  isComputer: boolean;
  oppHealth: number;
  oppStamina: number;
  oppStance: Stance;
  lastAction: LastAction | null;
  interactive: boolean;
  finished: boolean;
  winnerIsMe: boolean | null;
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
          setSpark({ x: actorIsMe ? 235 : 145, y: 128 });
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

  return (
    <div className="w-full">
      <style>{`
        @keyframes bx-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        @keyframes bx-spark-pop { 0% { transform: scale(0.3); opacity: 0; } 35% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
        .bx-shaking { animation: bx-shake 220ms ease-in-out; }
        .bx-spark { animation: bx-spark-pop 220ms ease-out; transform-origin: center; }
      `}</style>

      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">{myName}</p>
          <div className="mt-1 space-y-1">
            <StatBar label="Health" value={myHealth} max={100} tone="health" />
            <StatBar label="Stamina" value={myStamina} max={100} tone="stamina" />
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/50">
          vs
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[11px] font-black text-white">{oppName}</p>
          <div className="mt-1 space-y-1">
            <StatBar label="Health" value={oppHealth} max={100} tone="health" />
            <StatBar label="Stamina" value={oppStamina} max={100} tone="stamina" />
          </div>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)" }}>
        <svg viewBox="0 0 380 224" className={`block w-full ${shake ? "bx-shaking" : ""}`}>
          <defs>
            <radialGradient id="bx-mat" cx="50%" cy="30%" r="90%">
              <stop offset="0%" stopColor="hsl(220 45% 15%)" />
              <stop offset="55%" stopColor="hsl(224 48% 9%)" />
              <stop offset="100%" stopColor="hsl(226 50% 5%)" />
            </radialGradient>
            <radialGradient id="bx-glove-sheen" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
            </radialGradient>
          </defs>
          <rect width="380" height="224" fill="url(#bx-mat)" />

          {/* Crowd silhouettes */}
          <g opacity="0.5">
            {Array.from({ length: 16 }).map((_, i) => {
              const x = 6 + i * 24.5;
              const h = 8 + ((i * 7) % 6);
              return (
                <g key={i}>
                  <circle cx={x} cy={26 - h * 0.3} r="4" fill="#0a0e18" />
                  <path d={`M ${x - 6} ${30 - h * 0.3} Q ${x} ${20 - h * 0.3} ${x + 6} ${30 - h * 0.3} Z`} fill="#0a0e18" />
                </g>
              );
            })}
          </g>
          <rect x="0" y="0" width="380" height="34" fill="url(#bx-mat)" opacity="0.5" />

          {/* Ropes */}
          {[
            { y: 40, c: "#e9e4d8" },
            { y: 55, c: "hsl(204 100% 55%)" },
            { y: 70, c: "#e0453f" },
          ].map((r) => (
            <line key={r.y} x1="14" y1={r.y} x2="366" y2={r.y} stroke={r.c} strokeOpacity="0.85" strokeWidth="2.5" />
          ))}
          {/* Corner posts + turnbuckle pads */}
          {[18, 362].map((x) => (
            <g key={x}>
              <rect x={x - 5} y="30" width="10" height="58" rx="3" fill="#2a1810" />
              <rect x={x - 8} y="34" width="16" height="12" rx="4" fill="hsl(204 100% 45%)" opacity="0.8" />
            </g>
          ))}

          {/* Canvas mat watermark */}
          <text x="190" y="150" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="34" fill="rgba(255,255,255,0.04)">
            YAJ
          </text>
          {/* Floor line */}
          <line x1="0" y1="197" x2="380" y2="197" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

          <Fighter side="left" skin="tan" accent="hsl(204 100% 55%)" anim={myAnim} />
          <Fighter side="right" skin="deep" accent="#f59e0b" anim={oppAnim} />
          {spark && <ImpactSpark x={spark.x} y={spark.y} />}
        </svg>
        {isComputer && (
          <div className="absolute right-2 top-2 rounded-full bg-black/55 p-1">
            <Bot className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>

      {interactive && !finished ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {(["jab", "hook", "uppercut", "block", "dodge"] as Action[]).map((a) => {
            const Icon = ACTION_META[a].icon;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onAction(a)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-2 text-white active:scale-95"
              >
                <Icon className={`h-4 w-4 ${a === "block" || a === "dodge" ? "text-primary" : "text-white"}`} />
                <span className="text-[9px] font-black uppercase leading-none">{a}</span>
                <span className="text-[7px] font-bold leading-none text-white/40">{ACTION_META[a].hint}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-center text-[10px] font-bold text-white/40">
          {finished ? "Match over." : `Waiting on ${oppName}…`}
        </p>
      )}
    </div>
  );
}
