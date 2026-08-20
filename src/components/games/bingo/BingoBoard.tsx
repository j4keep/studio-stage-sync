import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import {
  BingoCard,
  MAX_DRAWS,
  RoundResult,
  generateCard,
  generateDrawSequence,
  hasBingo,
  markedGrid,
  pointsForDraws,
} from "@/lib/bingo-run";
import { bingoSfx } from "@/lib/bingo-sfx";

const COLUMN_LETTERS = ["B", "I", "N", "G", "O"];
const CALL_INTERVAL_MS = 1050;

function letterFor(n: number): string {
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
}

export default function BingoBoard({
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
  onComplete: (result: RoundResult) => void;
}) {
  const [help, setHelp] = useState(false);
  const [card, setCard] = useState<BingoCard>(() => generateCard());
  const [called, setCalled] = useState<number[]>([]);
  const [drawsUsed, setDrawsUsed] = useState(0);
  const [lineReady, setLineReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  const cardRef = useRef<BingoCard>(card);
  const sequenceRef = useRef<number[]>([]);
  const calledSetRef = useRef<Set<number>>(new Set());
  const drawIndexRef = useRef(0);
  const endedRef = useRef(false);
  const lineReadyRef = useRef(false);
  const autoClaimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const freshCard = generateCard();
    cardRef.current = freshCard;
    setCard(freshCard);
    sequenceRef.current = generateDrawSequence();
    calledSetRef.current = new Set();
    drawIndexRef.current = 0;
    endedRef.current = false;
    lineReadyRef.current = false;
    setCalled([]);
    setDrawsUsed(0);
    setLineReady(false);
    setEnded(false);
    setResultBanner(null);

    const finish = (won: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const points = pointsForDraws(drawIndexRef.current, won);
      if (won) {
        bingoSfx.bingo();
        setResultBanner(auto ? "They call BINGO!" : "BINGO!");
      } else {
        bingoSfx.buzzer();
        setResultBanner("No bingo this round");
      }
      window.setTimeout(() => {
        onComplete({ points, drawsUsed: drawIndexRef.current, won });
      }, 1100);
    };

    const drawNext = () => {
      if (endedRef.current) return;
      if (drawIndexRef.current >= sequenceRef.current.length || drawIndexRef.current >= MAX_DRAWS) {
        finish(false);
        return;
      }
      const n = sequenceRef.current[drawIndexRef.current];
      drawIndexRef.current += 1;
      calledSetRef.current.add(n);
      setCalled((cur) => [...cur, n]);
      setDrawsUsed(drawIndexRef.current);
      bingoSfx.call();

      const onCard = cardRef.current.some((row) => row.includes(n));
      if (onCard) bingoSfx.mark();

      const marked = markedGrid(cardRef.current, calledSetRef.current);
      const nowHasLine = hasBingo(marked);
      if (nowHasLine && !lineReadyRef.current) {
        lineReadyRef.current = true;
        setLineReady(true);
        if (auto) {
          bingoSfx.closeCall();
          const reactionDelay = 400 + (1 - skill) * 1800 + Math.random() * 400;
          autoClaimTimerRef.current = window.setTimeout(() => finish(true), reactionDelay);
        } else {
          bingoSfx.closeCall();
        }
      }
    };

    const timerId = window.setInterval(drawNext, CALL_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
      if (autoClaimTimerRef.current) window.clearTimeout(autoClaimTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const claimBingo = () => {
    if (auto || !lineReadyRef.current || endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    const points = pointsForDraws(drawIndexRef.current, true);
    bingoSfx.bingo();
    setResultBanner("BINGO!");
    window.setTimeout(() => {
      onComplete({ points, drawsUsed: drawIndexRef.current, won: true });
    }, 1100);
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(270,45%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  const calledSet = new Set(called);
  const marked = markedGrid(card, calledSet);
  const currentNumber = called[called.length - 1] ?? null;
  const recent = called.slice(-6, -1).reverse();

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(270 45% 16%) 0%, hsl(268 45% 9%) 45%, hsl(266 45% 6%) 100%)" }}
    >
      <style>{`
        @keyframes bg-pop { 0% { transform: scale(0.5); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bg-mark { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bg-glow { 0%, 100% { box-shadow: 0 0 8px rgba(240,216,76,0.5); } 50% { box-shadow: 0 0 22px rgba(240,216,76,0.95); } }
        .bg-pop { animation: bg-pop 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        .bg-mark { animation: bg-mark 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        .bg-glow { animation: bg-glow 1s ease-in-out infinite; }
      `}</style>

      <div
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 pb-6"
        style={{ paddingTop: "calc(4.75rem + env(safe-area-inset-top))" }}
      >
        {/* Caller display */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Now Calling</span>
          {currentNumber !== null ? (
            <div
              key={currentNumber}
              className="bg-pop flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 border-[#f0d84c] bg-black/60 text-center"
              style={{ boxShadow: "0 0 30px rgba(240,216,76,0.55)" }}
            >
              <span className="text-xl font-black leading-none text-[#f0d84c]">{letterFor(currentNumber)}</span>
              <span className="text-4xl font-black leading-none text-white">{currentNumber}</span>
            </div>
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/20 bg-black/40">
              <span className="text-xs font-bold text-white/40">Get ready…</span>
            </div>
          )}
          <div className="flex gap-1.5">
            {recent.map((n) => (
              <span key={n} className="rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white/50">
                {letterFor(n)}{n}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="grid w-full max-w-[340px] grid-cols-5 gap-2">
          {COLUMN_LETTERS.map((l) => (
            <div key={l} className="flex items-center justify-center py-1 text-lg font-black text-[#f0d84c]">
              {l}
            </div>
          ))}
          {card.map((row, r) =>
            row.map((n, c) => {
              const isMarked = marked[r][c];
              const isFree = r === 2 && c === 2;
              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex aspect-square items-center justify-center rounded-lg border text-base font-black ${isMarked ? "bg-mark" : ""}`}
                  style={{
                    background: isMarked ? "linear-gradient(160deg, #f0d84c, #c9962e)" : "rgba(255,255,255,0.06)",
                    borderColor: isMarked ? "#a8791f" : "rgba(255,255,255,0.15)",
                    color: isMarked ? "#241a05" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {isFree ? "★" : n}
                </div>
              );
            }),
          )}
        </div>

        {resultBanner && (
          <div className="pointer-events-none absolute inset-x-6 top-1/2 z-30 flex -translate-y-1/2 justify-center">
            <span
              className="rounded-2xl border-2 border-[#f0d84c] bg-black/85 px-6 py-3 text-2xl font-black uppercase tracking-widest text-[#f0d84c]"
              style={{ textShadow: "0 0 14px rgba(240,216,76,0.9)" }}
            >
              {resultBanner}
            </span>
          </div>
        )}

        {help ? (
          <ul className="absolute inset-x-6 top-24 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[11px] text-white/80 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}

        {/* Bingo button */}
        {!auto && (
          <button
            type="button"
            onClick={claimBingo}
            disabled={!lineReady || ended}
            className={`w-full max-w-[340px] rounded-full py-3 text-lg font-black uppercase tracking-wide transition-transform active:scale-95 ${
              lineReady && !ended ? "bg-glow bg-[#f0d84c] text-black" : "bg-white/10 text-white/30"
            }`}
          >
            {lineReady ? "Tap BINGO!" : "Bingo"}
          </button>
        )}
        {auto && (
          <p className="text-[10px] font-bold text-white/40">
            {lineReady ? "They've got a line…" : "Watching their card"}
          </p>
        )}
      </div>

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
            <span className="font-mono text-[26px] font-black leading-none tabular-nums text-red-500" style={{ textShadow: "0 0 10px rgba(239,68,68,0.9)" }}>
              {drawsUsed}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Calls</span>
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
