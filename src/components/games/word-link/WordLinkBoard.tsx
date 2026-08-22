import { useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, LogOut, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { ROUND_SECONDS, RoundResult, WordPuzzle, scoreWord, shufflePuzzles, ALL_FOUND_BONUS } from "@/lib/word-link-run";
import { wordLinkSfx } from "@/lib/word-link-sfx";

const WHEEL_SIZE = 380;
const TILE_R = 40;
const RADIUS = 145;
const CENTER = WHEEL_SIZE / 2;

function tilePosition(i: number, total: number) {
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
}

export default function WordLinkBoard({
  active,
  auto = false,
  skill = 0.65,
  myScore,
  oppScore,
  roundLabel,
  muted,
  onToggleMute,
  onBack,
  onQuit,
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
  onQuit?: () => void;
  howToPlay: string[];
  onComplete: (result: RoundResult) => void;
}) {
  const [help, setHelp] = useState(false);
  const [puzzle, setPuzzle] = useState<WordPuzzle | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [ended, setEnded] = useState(false);
  const [popup, setPopup] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);

  const puzzleRef = useRef<WordPuzzle | null>(null);
  const foundRef = useRef<Set<string>>(new Set());
  const pointsRef = useRef(0);
  const draggingRef = useRef(false);
  const selectionRef = useRef<number[]>([]);
  const endedRef = useRef(false);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const popupIdRef = useRef(0);
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const shuffled = shufflePuzzles();
    const chosen = shuffled[0];
    puzzleRef.current = chosen;
    setPuzzle(chosen);
    foundRef.current = new Set();
    pointsRef.current = 0;
    draggingRef.current = false;
    selectionRef.current = [];
    endedRef.current = false;
    timeLeftRef.current = ROUND_SECONDS;
    setSelection([]);
    setFound([]);
    setTimeLeft(ROUND_SECONDS);
    setEnded(false);
    setPopup(null);
    setDragPoint(null);

    const finish = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      wordLinkSfx.buzzer();
      window.setTimeout(() => {
        onComplete({
          points: pointsRef.current,
          wordsFound: foundRef.current.size,
          totalWords: chosen.words.length,
        });
      }, 1000);
    };

    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish();
    }, 1000);

    // Computer auto-play: "finds" words from the answer list at a skill-scaled pace.
    let autoIndex = 0;
    if (auto) {
      const order = [...chosen.words].sort(() => Math.random() - 0.5);
      const tickAuto = () => {
        if (endedRef.current || autoIndex >= order.length) return;
        const w = order[autoIndex];
        autoIndex += 1;
        foundRef.current.add(w);
        pointsRef.current += scoreWord(w);
        setFound(Array.from(foundRef.current));
        if (foundRef.current.size >= chosen.words.length) {
          pointsRef.current += ALL_FOUND_BONUS;
          finish();
          return;
        }
        const delay = (1400 - skill * 900) * (0.6 + Math.random() * 0.8);
        autoTimerRef.current = window.setTimeout(tickAuto, delay);
      };
      autoTimerRef.current = window.setTimeout(tickAuto, 900);
    }

    return () => {
      window.clearInterval(timerId);
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const spawnPopup = (text: string, good: boolean) => {
    popupIdRef.current += 1;
    const id = popupIdRef.current;
    setPopup({ id, text, good });
    window.setTimeout(() => setPopup((cur) => (cur?.id === id ? null : cur)), 700);
  };

  const submitSelection = () => {
    const p = puzzleRef.current;
    const indices = selectionRef.current;
    draggingRef.current = false;
    selectionRef.current = [];
    setSelection([]);
    setDragPoint(null);
    if (!p || indices.length < 3) return;
    const word = indices.map((i) => p.letters[i]).join("");
    if (foundRef.current.has(word)) {
      wordLinkSfx.invalid();
      return;
    }
    if (!p.words.includes(word)) {
      wordLinkSfx.invalid();
      spawnPopup("Not in the puzzle", false);
      return;
    }
    foundRef.current.add(word);
    const pts = scoreWord(word);
    pointsRef.current += pts;
    setFound(Array.from(foundRef.current));
    wordLinkSfx.found(word.length);
    spawnPopup(`+${pts} ${word}`, true);
    if (foundRef.current.size >= p.words.length) {
      pointsRef.current += ALL_FOUND_BONUS;
      wordLinkSfx.allFound();
      spawnPopup(`All found! +${ALL_FOUND_BONUS}`, true);
      window.setTimeout(() => {
        if (!endedRef.current) {
          endedRef.current = true;
          setEnded(true);
          window.setTimeout(() => {
            onComplete({ points: pointsRef.current, wordsFound: foundRef.current.size, totalWords: p.words.length });
          }, 900);
        }
      }, 500);
    }
  };

  const hitTestTile = (clientX: number, clientY: number): number | null => {
    const el = wheelRef.current;
    const p = puzzleRef.current;
    if (!el || !p) return null;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / WHEEL_SIZE;
    const localX = (clientX - rect.left) / scale;
    const localY = (clientY - rect.top) / scale;
    for (let i = 0; i < p.letters.length; i++) {
      const pos = tilePosition(i, p.letters.length);
      if (Math.hypot(localX - pos.x, localY - pos.y) < TILE_R) return i;
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (auto || ended) return;
    const idx = hitTestTile(e.clientX, e.clientY);
    if (idx === null) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    selectionRef.current = [idx];
    setSelection([idx]);
    setDragPoint({ x: e.clientX, y: e.clientY });
    wordLinkSfx.tick(0);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setDragPoint({ x: e.clientX, y: e.clientY });
    const idx = hitTestTile(e.clientX, e.clientY);
    if (idx === null) return;
    const cur = selectionRef.current;
    if (cur[cur.length - 1] === idx) return;
    if (cur.includes(idx)) return;
    const next = [...cur, idx];
    selectionRef.current = next;
    setSelection(next);
    wordLinkSfx.tick(next.length);
  };
  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    submitSelection();
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(200,45%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  if (!puzzle) return null;

  const urgent = timeLeft <= 10;
  const current = selection.map((i) => puzzle.letters[i]).join("");

  let liveTrailEnd: { x: number; y: number } | null = null;
  if (dragPoint && selection.length > 0 && wheelRef.current) {
    const rect = wheelRef.current.getBoundingClientRect();
    const scale = rect.width / WHEEL_SIZE;
    liveTrailEnd = { x: (dragPoint.x - rect.left) / scale, y: (dragPoint.y - rect.top) / scale };
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(200 50% 16%) 0%, hsl(202 50% 9%) 45%, hsl(204 50% 6%) 100%)" }}
    >
      <style>{`
        @keyframes wl-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-4px) scale(1.15); opacity: 1; } 100% { transform: translateY(-30px) scale(1); opacity: 0; } }
        @keyframes wl-tile { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        .wl-pop { animation: wl-pop 700ms ease-out forwards; }
        .wl-tile-active { animation: wl-tile 200ms ease-out; }
      `}</style>

      <div
        className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 pb-6"
        style={{ paddingTop: "calc(4.75rem + env(safe-area-inset-top))" }}
      >
        {/* Current selection */}
        <div className="flex h-9 items-center justify-center rounded-full bg-black/40 px-5 min-w-[140px]">
          <span className="text-lg font-black tracking-widest text-white">{current || " "}</span>
        </div>

        {/* Letter wheel */}
        <div
          ref={wheelRef}
          className="relative touch-none select-none"
          style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <svg width={WHEEL_SIZE} height={WHEEL_SIZE} className="pointer-events-none absolute inset-0">
            {selection.length > 1 &&
              selection.slice(1).map((idx, i) => {
                const a = tilePosition(selection[i], puzzle.letters.length);
                const b = tilePosition(idx, puzzle.letters.length);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f0d84c" strokeWidth="4" strokeLinecap="round" opacity="0.85" />;
              })}
            {liveTrailEnd &&
              selection.length > 0 &&
              (() => {
                const last = tilePosition(selection[selection.length - 1], puzzle.letters.length);
                return <line x1={last.x} y1={last.y} x2={liveTrailEnd.x} y2={liveTrailEnd.y} stroke="#f0d84c" strokeWidth="3" strokeLinecap="round" opacity="0.5" />;
              })()}
          </svg>
          {puzzle.letters.split("").map((ch, i) => {
            const pos = tilePosition(i, puzzle.letters.length);
            const isSelected = selection.includes(i);
            return (
              <div
                key={i}
                className={`absolute flex items-center justify-center rounded-full border-2 text-xl font-black ${isSelected ? "wl-tile-active" : ""}`}
                style={{
                  left: pos.x - TILE_R,
                  top: pos.y - TILE_R,
                  width: TILE_R * 2,
                  height: TILE_R * 2,
                  background: isSelected ? "linear-gradient(160deg, #f0d84c, #c9962e)" : "rgba(255,255,255,0.08)",
                  borderColor: isSelected ? "#a8791f" : "rgba(255,255,255,0.2)",
                  color: isSelected ? "#241a05" : "#fff",
                }}
              >
                {ch}
              </div>
            );
          })}
        </div>

        {popup && (
          <span
            key={popup.id}
            className="wl-pop pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 rounded-full px-3 py-1 text-sm font-black"
            style={{ background: popup.good ? "#f0d84c" : "#ff6b6b", color: "#111" }}
          >
            {popup.text}
          </span>
        )}

        {/* Found words */}
        <div className="flex w-full max-w-[320px] flex-col items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {found.length} / {puzzle.words.length} words found
          </span>
          <div className="flex max-h-16 flex-wrap justify-center gap-1 overflow-y-auto">
            {found.map((w) => (
              <span key={w} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80">
                {w}
              </span>
            ))}
          </div>
        </div>

        {help ? (
          <ul className="absolute inset-x-6 top-16 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[11px] text-white/80 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}

        {auto && (
          <p className="text-[10px] font-bold text-white/40">Watching their board</p>
        )}
      </div>

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
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
            <span
              className={`font-mono text-[26px] font-black leading-none tabular-nums text-red-500 ${urgent ? "animate-pulse" : ""}`}
              style={{ textShadow: "0 0 10px rgba(239,68,68,0.9)" }}
            >
              0:{String(timeLeft).padStart(2, "0")}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Round Clock</span>
          </div>
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-red-300">Rival</span>
            <span className="text-xl font-black leading-none text-red-300" style={{ textShadow: "0 0 8px rgba(248,113,113,0.85)" }}>
              {oppScore}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          <GameMenu
            triggerClassName="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 text-white active:scale-95"
            actions={[
              { key: "help", label: "How to Play", icon: HelpCircle, onClick: () => setHelp((v) => !v) },
              { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
              { key: "back", label: "Back to Games", icon: ArrowLeft, onClick: onBack },
              ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
            ]}
          />
        </div>
      </div>
      <p className="pointer-events-none absolute left-1/2 top-[3.1rem] z-30 -translate-x-1/2 text-[8px] font-bold text-white/35">{roundLabel}</p>
    </div>
  );
}
