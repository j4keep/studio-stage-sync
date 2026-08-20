import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import { Course, Obstacle, RunResult, TRACK_LENGTH, scoreRun, spawnCourse } from "@/lib/tumble-guys-run";
import { tumbleGuysSfx } from "@/lib/tumble-guys-sfx";

// Portrait canvas — same fixed-viewBox trick as every other physics game this session: the
// course scrolls past a runner fixed near the bottom of the screen, so the tick logic only
// ever deals with logical track-units, never real device pixels.
const VIEW_W = 480;
const VIEW_H = 900;
const PLAYER_X = VIEW_W / 2;
const PLAYER_SCREEN_Y = 680;
const PIXELS_PER_UNIT = 34;
const RUN_SPEED = 10; // track-units/sec
const JUMP_DURATION = 1.1; // seconds airborne — reach (11 units) comfortably exceeds OBSTACLE_WIDTH (4)
/** How far before a hazard's leading edge the AI takes off — small on purpose: takeoff distance
 *  eats directly into the jump's landing margin (reach is fixed, so jumping earlier lands
 *  earlier too), so this only needs to cover reaction lag, not act as extra safety margin. */
const AI_EARLY_MARGIN = 1.2;
const JUMP_HEIGHT_PX = 92;
const PICKUP_RADIUS = 0.6;
const TICK_MS = 16;
const ROUND_SECONDS_CAP = 20;

function worldToScreenY(distance: number, playerDistance: number) {
  return PLAYER_SCREEN_Y - (distance - playerDistance) * PIXELS_PER_UNIT;
}

type Popup = { id: number; text: string };

export default function TumbleGuysBoard({
  active,
  auto = false,
  skill = 0.65,
  myScore,
  oppScore,
  roundLabel,
  muted,
  onToggleMute,
  onBack,
  howToPlay,
  onComplete,
}: {
  active: boolean;
  auto?: boolean;
  skill?: number;
  myScore: number;
  oppScore: number;
  roundLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  howToPlay: string[];
  onComplete: (result: RunResult) => void;
}) {
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [help, setHelp] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [distance, setDistance] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [ended, setEnded] = useState(false);

  const courseRef = useRef<Course | null>(null);
  const playerDistanceRef = useRef(0);
  const jumpTRef = useRef(0);
  const endedRef = useRef(false);
  const coinsRef = useRef(0);
  const collectedCoinsRef = useRef<Set<number>>(new Set());
  const popupIdRef = useRef(0);
  const autoTargetRef = useRef<{ index: number; triggerDistance: number } | null>(null);
  const timeLeftRef = useRef(ROUND_SECONDS_CAP);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS_CAP);
  const jumpHandlerRef = useRef<(() => void) | null>(null);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const skillRef = useRef(skill);
  skillRef.current = skill;

  useEffect(() => {
    if (!active) return;
    const c = spawnCourse();
    courseRef.current = c;
    setCourse(c);
    playerDistanceRef.current = 0;
    jumpTRef.current = 0;
    endedRef.current = false;
    coinsRef.current = 0;
    collectedCoinsRef.current = new Set();
    autoTargetRef.current = null;
    timeLeftRef.current = ROUND_SECONDS_CAP;
    setDistance(0);
    setCoinsCollected(0);
    setPopup(null);
    setEnded(false);
    setTimeLeft(ROUND_SECONDS_CAP);

    const spawnPopup = (text: string) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text };
      setPopup(p);
      window.setTimeout(() => setPopup((cur) => (cur?.id === p.id ? null : cur)), 900);
    };

    const finish = (finished: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const d = Math.min(playerDistanceRef.current, TRACK_LENGTH);
      const score = scoreRun(d, coinsRef.current, finished);
      if (finished) {
        spawnPopup(`FINISH! +${score}`);
        tumbleGuysSfx.finish();
      } else {
        spawnPopup("TUMBLED!");
        tumbleGuysSfx.tumble();
      }
      window.setTimeout(() => {
        onComplete({ distance: d, coins: coinsRef.current, finished, score });
      }, 1000);
    };

    const jump = () => {
      if (endedRef.current || jumpTRef.current > 0) return;
      jumpTRef.current = 0.0001;
      tumbleGuysSfx.jump();
    };
    jumpHandlerRef.current = jump;

    // Safety-net timer — the run always finishes on its own well before this in practice.
    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish(false);
    }, 1000);

    const loop = window.setInterval(() => {
      if (endedRef.current) return;
      const dt = TICK_MS / 1000;
      const track = courseRef.current!;

      playerDistanceRef.current += RUN_SPEED * dt;
      if (jumpTRef.current > 0) {
        jumpTRef.current += dt;
        if (jumpTRef.current >= JUMP_DURATION) jumpTRef.current = 0;
      }
      const airborne = jumpTRef.current > 0;
      const d = playerDistanceRef.current;

      if (d >= TRACK_LENGTH) {
        finish(true);
        bump();
        return;
      }

      // Computer: closed-form jump timing at the next hazard, skill-scaled noise on when it
      // actually triggers — same "aim deterministically, don't rely on emergent physics"
      // approach used everywhere else, applied to a single timed tap instead of an angle.
      if (autoRef.current) {
        const next = track.obstacles.find((o) => o.distance + o.width > d);
        if (next) {
          if (!autoTargetRef.current || autoTargetRef.current.index !== track.obstacles.indexOf(next)) {
            // Most jumps are timed cleanly; a low-skill computer occasionally reacts so late
            // that the trigger point lands at or past the hazard's own leading edge — no amount
            // of small timing jitter around a *safe* trigger point can ever miss once the jump's
            // reach comfortably exceeds the hazard width, so a real miss has to come from
            // reacting to the wrong moment entirely, not just imprecisely.
            const poorReactionChance = (1 - skillRef.current) * 0.35;
            const idealTrigger = next.distance - AI_EARLY_MARGIN;
            const triggerDistance =
              Math.random() < poorReactionChance
                ? next.distance + Math.random() * next.width * 0.7
                : idealTrigger + (Math.random() - 0.5) * 1.0;
            autoTargetRef.current = { index: track.obstacles.indexOf(next), triggerDistance };
          }
          if (!airborne && d >= autoTargetRef.current.triggerDistance) jumpHandlerRef.current?.();
        }
      }

      // Coin pickups.
      track.coins.forEach((c, i) => {
        if (collectedCoinsRef.current.has(i)) return;
        if (Math.abs(d - c.distance) < PICKUP_RADIUS) {
          collectedCoinsRef.current.add(i);
          coinsRef.current += 1;
          setCoinsCollected(coinsRef.current);
          tumbleGuysSfx.coin();
          spawnPopup("+COIN");
        }
      });

      // Hazard collision — lethal unless airborne for the entire pass-through window.
      for (const o of track.obstacles) {
        if (d >= o.distance && d < o.distance + o.width) {
          if (!airborne) {
            finish(false);
            bump();
            return;
          }
        }
      }

      setDistance(d);
      bump();
    }, TICK_MS);

    return () => {
      window.clearInterval(loop);
      window.clearInterval(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const canTap = active && !auto && !ended;

  const handleTap = () => {
    if (!canTap) return;
    jumpHandlerRef.current?.();
  };

  if (!active || !course) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(28,55%,10%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other run to finish…</p>
      </div>
    );
  }

  const jumpProgress = jumpTRef.current > 0 ? Math.min(1, jumpTRef.current / JUMP_DURATION) : 0;
  const playerLift = jumpProgress > 0 ? JUMP_HEIGHT_PX * 4 * jumpProgress * (1 - jumpProgress) : 0;
  const pct = Math.min(100, Math.round((distance / TRACK_LENGTH) * 100));

  return (
    <div
      className="relative h-full w-full overflow-hidden touch-none select-none"
      style={{ background: "linear-gradient(180deg, hsl(28 55% 18%) 0%, hsl(26 55% 11%) 45%, hsl(24 58% 6%) 100%)" }}
      onPointerDown={handleTap}
    >
      <style>{`
        @keyframes tg-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.15); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        .tg-pop { animation: tg-pop 900ms ease-out forwards; }
        @keyframes tg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tg-spin { animation: tg-spin 900ms linear infinite; transform-origin: center; }
        @keyframes tg-swing { 0%,100% { transform: rotate(-28deg); } 50% { transform: rotate(28deg); } }
        .tg-swing { animation: tg-swing 1.1s ease-in-out infinite; transform-origin: top center; }
      `}</style>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
        {/* Running lane */}
        <rect x={PLAYER_X - 90} y="0" width="180" height={VIEW_H} fill="rgba(255,255,255,0.05)" />
        <line x1={PLAYER_X - 90} y1="0" x2={PLAYER_X - 90} y2={VIEW_H} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        <line x1={PLAYER_X + 90} y1="0" x2={PLAYER_X + 90} y2={VIEW_H} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

        {/* Finish line */}
        {(() => {
          const y = worldToScreenY(TRACK_LENGTH, distance);
          if (y < -40 || y > VIEW_H + 40) return null;
          return (
            <g>
              <rect x={PLAYER_X - 90} y={y - 6} width="180" height="12" fill="#f0d84c" opacity="0.9" />
              <text x={PLAYER_X} y={y - 16} textAnchor="middle" fontSize="20" fontWeight="900" fill="#f0d84c">
                FINISH
              </text>
            </g>
          );
        })()}

        {/* Obstacles */}
        {course.obstacles.map((o, i) => {
          const yNear = worldToScreenY(o.distance, distance);
          const yFar = worldToScreenY(o.distance + o.width, distance);
          if (yNear < -60 || yFar > VIEW_H + 60) return null;
          return <ObstacleGraphic key={i} kind={o.kind} yTop={yFar} yBottom={yNear} />;
        })}

        {/* Coins */}
        {course.coins.map((c, i) => {
          if (collectedCoinsRef.current.has(i)) return null;
          const y = worldToScreenY(c.distance, distance);
          if (y < -30 || y > VIEW_H + 30) return null;
          return <circle key={i} cx={PLAYER_X} cy={y} r="12" fill="#ffd54a" stroke="#a87a12" strokeWidth="2" />;
        })}

        {/* Player */}
        <g transform={`translate(${PLAYER_X} ${PLAYER_SCREEN_Y - playerLift})`}>
          <ellipse cx="0" cy={18 + Math.min(playerLift, 30) * 0.15} rx={26 - playerLift * 0.08} ry="8" fill="rgba(0,0,0,0.3)" />
          <circle r="26" fill="#4da6ff" stroke="#0d3a6b" strokeWidth="3" />
          <circle cx="-8" cy="-4" r="4" fill="#0d1b2a" />
          <circle cx="8" cy="-4" r="4" fill="#0d1b2a" />
        </g>
      </svg>

      {popup && (
        <span
          key={popup.id}
          className="tg-pop pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 rounded-full bg-[#f0d84c] px-3 py-1 text-sm font-black text-black"
        >
          {popup.text}
        </span>
      )}

      {auto && !ended && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Watching their dash</p>
      )}
      {canTap && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Tap anywhere to jump</p>
      )}

      {help ? (
        <ul className="absolute inset-x-6 top-16 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[11px] text-white/80 animate-fade-in">
          {howToPlay.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto shrink-0 rounded-full bg-black/55 p-1.5 text-white active:scale-95">
          <X className="h-4 w-4" />
        </button>

        <div
          className="flex items-center rounded-2xl border-2 px-1 py-1"
          style={{ borderColor: "rgba(240,216,76,0.35)", background: "rgba(10,6,4,0.88)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-300">You</span>
            <span className="text-xl font-black leading-none text-blue-300" style={{ textShadow: "0 0 8px rgba(96,165,250,0.85)" }}>
              {myScore}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15 px-3">
            <span className={`font-mono text-[22px] font-black leading-none tabular-nums text-[#f0d84c] ${timeLeft <= 5 ? "animate-pulse" : ""}`} style={{ textShadow: "0 0 10px rgba(240,216,76,0.85)" }}>
              {pct}%
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Coins {coinsCollected}</span>
          </div>
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-red-300">Rival</span>
            <span className="text-xl font-black leading-none text-red-300" style={{ textShadow: "0 0 8px rgba(248,113,113,0.85)" }}>
              {oppScore}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleMute} aria-label="Mute" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="pointer-events-none absolute left-1/2 top-[3.1rem] z-30 -translate-x-1/2 text-[8px] font-bold text-white/35">{roundLabel}</p>
    </div>
  );
}

function ObstacleGraphic({ kind, yTop, yBottom }: { kind: Obstacle["kind"]; yTop: number; yBottom: number }) {
  const cx = VIEW_W / 2;
  const cy = (yTop + yBottom) / 2;
  const height = Math.max(10, yBottom - yTop);

  if (kind === "gap") {
    return (
      <g>
        <rect x={cx - 90} y={yTop} width="180" height={height} fill="#050708" />
        <rect x={cx - 90} y={yTop} width="180" height={height} fill="none" stroke="#c0392b" strokeWidth="2" strokeDasharray="6 5" opacity="0.8" />
      </g>
    );
  }
  if (kind === "bar") {
    return (
      <g transform={`translate(${cx} ${cy})`}>
        <rect x={-95} y={-height / 2 - 4} width="190" height={height + 8} fill="none" />
        <g className="tg-spin">
          <rect x={-70} y="-6" width="140" height="12" rx="5" fill="#c0392b" stroke="#5c1a12" strokeWidth="2" />
        </g>
      </g>
    );
  }
  // swinger: a pendulum hammer hanging from above, arcing back and forth over the lane.
  // The rotation lives on a nested <g> with no positioning attribute of its own — mixing an SVG
  // `transform` attribute with a CSS animation's `transform` on the same element makes browsers
  // drop the attribute-based translate once the animation applies, flinging the hammer to the
  // viewBox origin instead of its actual lane position.
  return (
    <g transform={`translate(${cx} ${yTop})`}>
      <g className="tg-swing">
        <line x1="0" y1="0" x2="0" y2={Math.max(20, height * 0.6)} stroke="#8a8a8a" strokeWidth="4" />
        <circle cx="0" cy={Math.max(20, height * 0.6)} r="18" fill="#6b6b6b" stroke="#2c2c2c" strokeWidth="3" />
      </g>
    </g>
  );
}
