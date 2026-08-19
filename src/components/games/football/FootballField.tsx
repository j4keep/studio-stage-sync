import { useEffect, useRef, useState } from "react";
import { Bot, Goal, Rocket, Send, Volume2, VolumeX, Wind, X, Zap } from "lucide-react";
import type { PlayKind, PlayType } from "@/lib/football";
import { footballSfx } from "@/lib/football-sfx";
import FootballAction from "./FootballAction";
import { PLAYER_KEYFRAMES } from "./PlayerArt";


type LastPlayView = { play: PlayType; kind: PlayKind; yards: number; message: string; mine: boolean } | null;

const PLAY_META: Record<PlayType, { label: string; hint: string; Icon: typeof Zap; tone: "safe" | "risky" }> = {
  run: { label: "Run", hint: "low risk", Icon: Zap, tone: "safe" },
  short_pass: { label: "Short", hint: "reliable", Icon: Send, tone: "safe" },
  long_pass: { label: "Long", hint: "high risk", Icon: Rocket, tone: "risky" },
  punt: { label: "Punt", hint: "give up ball", Icon: Wind, tone: "safe" },
  field_goal: { label: "Kick", hint: "3 points", Icon: Goal, tone: "risky" },
};

function PlayButton({ play, disabled, onPress }: { play: PlayType; disabled: boolean; onPress: () => void }) {
  const meta = PLAY_META[play];
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="flex h-14 w-14 select-none flex-col items-center justify-center gap-0.5 rounded-full border-2 text-white shadow-lg active:scale-90 disabled:opacity-40"
      style={{
        borderColor: meta.tone === "risky" ? "#f59e0b" : "hsl(204 100% 55%)",
        background:
          meta.tone === "risky"
            ? "radial-gradient(circle at 35% 30%, #7a3f10, #2a1608)"
            : "radial-gradient(circle at 35% 30%, hsl(210 60% 22%), hsl(220 55% 8%))",
      }}
    >
      <meta.Icon className="h-4 w-4" />
      <span className="text-[7px] font-black uppercase leading-none">{meta.label}</span>
      <span className="text-[5.5px] font-bold leading-none text-white/50">{meta.hint}</span>
    </button>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function FootballField({
  myName,
  oppName,
  isComputer,
  myAccent,
  oppAccent,
  myScore,
  oppScore,
  myBall,
  down,
  yardsToGo,
  ballOnFromMyGoal,
  lastPlay,
  interactive,
  finished,
  winnerIsMe,
  statusLabel,
  playNumber,
  maxPlays,
  muted,
  onToggleMute,
  onBack,
  onPlay,
}: {
  myName: string;
  oppName: string;
  isComputer: boolean;
  myAccent: string;
  oppAccent: string;
  myScore: number;
  oppScore: number;
  myBall: boolean;
  down: number;
  yardsToGo: number;
  ballOnFromMyGoal: number;
  lastPlay: LastPlayView;
  interactive: boolean;
  finished: boolean;
  winnerIsMe: boolean | null;
  statusLabel: string;
  playNumber: number;
  maxPlays: number;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onPlay: (play: PlayType) => void;
}) {
  const [flash, setFlash] = useState<"td" | "turnover" | "score" | null>(null);
  const seen = useRef<string | null>(null);

  const fieldLeft = 100;
  const fieldRight = 800;
  const fieldWidth = fieldRight - fieldLeft;
  
  const firstDownMark = myBall ? ballOnFromMyGoal + yardsToGo : ballOnFromMyGoal - yardsToGo;
  const firstDownX = fieldLeft + (Math.max(0, Math.min(100, firstDownMark)) / 100) * fieldWidth;

  useEffect(() => {
    if (!lastPlay) return;
    const id = `${playNumber}-${lastPlay.kind}`;
    if (seen.current === id) return;
    seen.current = id;

    footballSfx.whistle();
    const intensity = Math.min(1, Math.abs(lastPlay.yards) / 15);
    if (lastPlay.play === "punt" || lastPlay.play === "field_goal") footballSfx.kick();
    if (lastPlay.kind === "incomplete") footballSfx.whiff();
    else if (lastPlay.kind === "gain" || lastPlay.kind === "first_down") footballSfx.impact(intensity);
    if (lastPlay.kind === "touchdown" || lastPlay.kind === "field_goal_good") footballSfx.crowd(1);
    else if (lastPlay.kind === "interception" || lastPlay.kind === "fumble" || lastPlay.kind === "turnover_on_downs" || lastPlay.kind === "safety") footballSfx.crowd(0.75);

    const flashKind =
      lastPlay.kind === "touchdown"
        ? "td"
        : lastPlay.kind === "field_goal_good"
          ? "score"
          : lastPlay.kind === "interception" || lastPlay.kind === "fumble" || lastPlay.kind === "turnover_on_downs" || lastPlay.kind === "safety"
            ? "turnover"
            : null;
    if (!flashKind) return;
    setFlash(flashKind);
    const t = window.setTimeout(() => setFlash(null), 1100);
    return () => window.clearTimeout(t);
  }, [lastPlay, playNumber]);

  const canAct = interactive && !finished;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(140 35% 14%) 0%, hsl(140 40% 8%) 45%, hsl(140 45% 4%) 100%)",
        paddingLeft: "max(0.4rem, env(safe-area-inset-left))",
        paddingRight: "max(0.4rem, env(safe-area-inset-right))",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <style>{`
        @keyframes fb-flash { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
        .fb-flash { animation: fb-flash 1.1s ease-out; }
        ${PLAYER_KEYFRAMES}
      `}</style>


      <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <defs>
          <linearGradient id="fb-turf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(132 45% 22%)" />
            <stop offset="100%" stopColor="hsl(132 48% 15%)" />
          </linearGradient>
          <radialGradient id="fb-mat" cx="50%" cy="26%" r="90%">
            <stop offset="0%" stopColor="hsl(140 35% 15%)" />
            <stop offset="55%" stopColor="hsl(140 40% 9%)" />
            <stop offset="100%" stopColor="hsl(140 45% 5%)" />
          </radialGradient>
        </defs>
        <rect width="900" height="420" fill="url(#fb-mat)" />

        {/* Crowd band */}
        <rect x="0" y="0" width="900" height="46" fill="hsl(140 40% 6%)" />
        <g>
          {Array.from({ length: 46 }).map((_, i) => {
            const row = i % 2;
            const x = 4 + (i - row) * 19.5 + row * 10;
            const y = row === 0 ? 34 : 22;
            const shirt = ["#3a3f52", "#4a2f3a", "#2f4a3f", "#4a3f2f", "#3f3f4a"][i % 5];
            return (
              <g key={i} opacity={0.5 + ((i * 7) % 4) * 0.08}>
                <ellipse cx={x} cy={y + 7} rx="7" ry="5" fill={shirt} />
                <circle cx={x} cy={y} r="3.8" fill="#1d1420" />
              </g>
            );
          })}
        </g>

        {/* Field */}
        <rect x={fieldLeft} y="90" width={fieldWidth} height="290" fill="url(#fb-turf)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        {/* End zones */}
        <rect x="40" y="90" width={fieldLeft - 40} height="290" fill={myAccent} opacity="0.28" />
        <rect x={fieldRight} y="90" width={860 - fieldRight} height="290" fill={oppAccent} opacity="0.28" />
        <text x="70" y="240" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="13" fill="rgba(255,255,255,0.5)" textAnchor="middle" transform="rotate(-90 70 240)">
          END ZONE
        </text>
        <text x="830" y="240" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="13" fill="rgba(255,255,255,0.5)" textAnchor="middle" transform="rotate(90 830 240)">
          END ZONE
        </text>

        {/* Yard lines every 10 yards */}
        {Array.from({ length: 11 }).map((_, i) => {
          const x = fieldLeft + (i / 10) * fieldWidth;
          const yard = i <= 5 ? i * 10 : (10 - i) * 10;
          return (
            <g key={i}>
              <line x1={x} y1="90" x2={x} y2="380" stroke="rgba(255,255,255,0.28)" strokeWidth={i === 0 || i === 10 ? 3 : 1.4} />
              {i !== 0 && i !== 10 && (
                <text x={x} y="365" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="14" fill="rgba(255,255,255,0.3)">
                  {yard}
                </text>
              )}
            </g>
          );
        })}
        <line x1={fieldLeft} y1="235" x2={fieldRight} y2="235" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 6" />

        {/* First-down marker */}
        {!finished && <line x1={firstDownX} y1="88" x2={firstDownX} y2="382" stroke="#f0d84c" strokeWidth="3" opacity="0.85" />}

        {/* Players, mascots and the ball */}
        <FootballAction
          fieldLeft={fieldLeft}
          fieldWidth={fieldWidth}
          ballOnFromMyGoal={ballOnFromMyGoal}
          myBall={myBall}
          lastPlay={lastPlay}
          playNumber={playNumber}
          myAccent={myAccent}
          oppAccent={oppAccent}
        />


        {flash && (
          <rect
            width="900"
            height="420"
            className="fb-flash"
            fill={flash === "turnover" ? "rgba(220,38,38,0.35)" : "rgba(240,216,76,0.3)"}
          />
        )}
      </svg>

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <X className="h-4 w-4" />
          </button>
          <div className="w-28 rounded-xl bg-black/45 p-1.5">
            <p className="mb-0.5 flex items-center gap-1 truncate text-[10px] font-black text-white">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: myAccent }} />
              {myName}
            </p>
            <p className="text-xl font-black leading-none text-white">{myScore}</p>
          </div>
        </div>
        <div className="mt-0.5 flex flex-col items-center gap-1">
          <span className="rounded-full bg-black/60 px-3 py-0.5 text-[11px] font-black tabular-nums text-white">
            {ordinal(down)} &amp; {yardsToGo}
          </span>
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/80">{statusLabel}</span>
          <span className="text-[8px] font-bold text-white/40">
            Play {Math.min(playNumber, maxPlays)}/{maxPlays}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="w-28 rounded-xl bg-black/45 p-1.5 text-right">
            <p className="mb-0.5 flex items-center justify-end gap-1 truncate text-[10px] font-black text-white">
              {isComputer && <Bot className="h-3 w-3 text-primary" />} {oppName}
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: oppAccent }} />
            </p>
            <p className="text-xl font-black leading-none text-white">{oppScore}</p>
          </div>
          <button type="button" onClick={onToggleMute} aria-label="Mute" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Play-call row */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex flex-col items-center gap-1.5">
        {lastPlay?.message && (
          <span className="max-w-[80%] truncate rounded-full bg-black/55 px-3 py-0.5 text-[10px] font-bold text-white/85">{lastPlay.message}</span>
        )}
        <div className="pointer-events-auto flex items-center gap-2">
          {(["run", "short_pass", "long_pass", "punt", "field_goal"] as PlayType[]).map((p) => (
            <PlayButton key={p} play={p} disabled={!canAct} onPress={() => onPlay(p)} />
          ))}
        </div>
        {!canAct && !finished && <p className="text-[10px] font-bold text-white/40">Waiting on {myBall ? myName : oppName}…</p>}
      </div>
    </div>
  );
}
