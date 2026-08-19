import { useEffect, useRef, useState } from "react";
import { Bot, Shield, Wind, Zap } from "lucide-react";
import { Action, LastAction, PUNCH_STATS, PunchType, Stance } from "@/lib/boxing";

type FighterAnim = "idle" | "jab" | "hook" | "uppercut" | "guard-block" | "guard-dodge" | "hit" | "ko";

function Fighter({
  side,
  color,
  anim,
  ko,
}: {
  side: "left" | "right";
  color: string;
  anim: FighterAnim;
  ko: boolean;
}) {
  const facing = side === "left" ? 1 : -1;
  const punchOut = anim === "jab" ? 26 : anim === "hook" ? 20 : anim === "uppercut" ? 16 : 0;
  const punchLift = anim === "uppercut" ? -14 : anim === "hook" ? -4 : 0;
  const guardUp = anim === "guard-block" || anim === "guard-dodge";
  const hit = anim === "hit";
  const cx = side === "left" ? 92 : 288;

  return (
    <g
      style={{
        transform: `translateX(${(punchOut + (guardUp ? -4 : 0) + (hit ? -6 : 0)) * facing}px) ${ko ? "rotate(" + (facing > 0 ? 78 : -78) + "deg) translateY(38px)" : ""}`,
        transformOrigin: `${cx}px 168px`,
        transition: "transform 160ms ease-out",
      }}
    >
      {/* Legs */}
      <rect x={cx - 16} y="150" width="10" height="34" rx="4" fill="#1c2431" />
      <rect x={cx + 6} y="150" width="10" height="34" rx="4" fill="#1c2431" />
      {/* Torso */}
      <rect x={cx - 20} y="98" width="40" height="58" rx="14" fill={hit ? "#ff5b5b" : color} style={{ transition: "fill 120ms" }} />
      {/* Waistband */}
      <rect x={cx - 20} y="140" width="40" height="10" rx="4" fill="#0b1220" opacity="0.5" />
      {/* Back arm (near body, mostly static) */}
      <rect
        x={cx - 6 * facing}
        y="108"
        width="9"
        height="30"
        rx="4.5"
        fill={color}
        style={{ transform: `rotate(${12 * facing}deg)`, transformOrigin: `${cx}px 110px` }}
      />
      {/* Head */}
      <circle cx={cx + 2 * facing} cy="84" r="19" fill="#e7c9a5" />
      <circle cx={cx + 8 * facing} cy="80" r="2.6" fill="#20242e" />
      {/* Front arm + glove — the one that animates */}
      <g
        style={{
          transform: guardUp
            ? `translate(${10 * facing}px, -34px) rotate(${-30 * facing}deg)`
            : `translate(${(punchOut * 0.9 + 6) * facing}px, ${punchLift}px) rotate(${(guardUp ? -30 : hit ? 8 : 4) * facing}deg)`,
          transformOrigin: `${cx}px 112px`,
          transition: "transform 150ms ease-out",
        }}
      >
        <rect x={cx - 5} y="106" width="10" height="28" rx="5" fill={color} />
        <circle cx={cx + 4 * facing} cy="132" r="10.5" fill="#f5f2ea" stroke="#c8c0ae" strokeWidth="1.5" />
      </g>
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
  const seenTurn = useRef<number | null>(null);

  useEffect(() => {
    if (!lastAction || seenTurn.current === lastAction.turn) return;
    seenTurn.current = lastAction.turn;
    const actorIsMe = lastAction.seat === 0;
    const setActor = actorIsMe ? setMyAnim : setOppAnim;
    const setTarget = actorIsMe ? setOppAnim : setMyAnim;

    if (lastAction.action === "block" || lastAction.action === "dodge") {
      setActor(lastAction.action === "block" ? "guard-block" : "guard-dodge");
      const t = window.setTimeout(() => setActor("idle"), 700);
      return () => window.clearTimeout(t);
    }

    setActor(lastAction.action as PunchType);
    const timers: number[] = [];
    if (lastAction.hit) {
      timers.push(window.setTimeout(() => setTarget("hit"), 130));
      timers.push(
        window.setTimeout(() => {
          const koNow = (actorIsMe ? oppHealth : myHealth) <= 0;
          setTarget(koNow ? "ko" : "idle");
        }, 430),
      );
    }
    timers.push(window.setTimeout(() => setActor("idle"), 320));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction?.turn]);

  const myKo = finished && winnerIsMe === false;
  const oppKo = finished && winnerIsMe === true;

  return (
    <div className="w-full">
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
        <svg viewBox="0 0 380 210" className="block w-full">
          <defs>
            <radialGradient id="bx-mat" cx="50%" cy="35%" r="85%">
              <stop offset="0%" stopColor="hsl(220 45% 16%)" />
              <stop offset="60%" stopColor="hsl(224 48% 10%)" />
              <stop offset="100%" stopColor="hsl(226 50% 6%)" />
            </radialGradient>
          </defs>
          <rect width="380" height="210" fill="url(#bx-mat)" />
          {/* Ropes */}
          {[36, 50, 64].map((y, i) => (
            <line key={y} x1="10" y1={y} x2="370" y2={y} stroke={i === 1 ? "hsl(204 100% 55%)" : "#e9e4d8"} strokeOpacity={i === 1 ? 0.85 : 0.55} strokeWidth="2.5" />
          ))}
          {/* Corner posts */}
          {[16, 364].map((x) => (
            <rect key={x} x={x - 5} y="20" width="10" height="52" rx="3" fill="#2a1810" />
          ))}
          {/* Canvas floor line */}
          <line x1="0" y1="184" x2="380" y2="184" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

          <Fighter side="left" color="hsl(204 100% 55%)" anim={myAnim} ko={myKo} />
          <Fighter side="right" color="#f59e0b" anim={oppAnim} ko={oppKo} />
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
