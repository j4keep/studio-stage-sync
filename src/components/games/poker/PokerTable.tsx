import { ReactNode, useEffect, useState } from "react";
import { ArrowLeft, Bot, HelpCircle, Volume2, VolumeX } from "lucide-react";
import { Card, PokerAction, PokerState, RANK_LABEL, Seat, legalActions } from "@/lib/poker";

const SUIT_SYMBOL: Record<Card["suit"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RED_SUITS = new Set(["h", "d"]);

type Props = {
  state: PokerState;
  mySeat: Seat;
  myTurn: boolean;
  matchOver: boolean;
  myName: string;
  myAvatar: string | null;
  oppName: string;
  oppAvatar: string | null;
  isComputer: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  howToPlay: string[];
  onAction: (action: PokerAction, amount?: number) => void;
  onNextHand: () => void;
  sideDock?: ReactNode;
};

function PlayingCard({ card, faceDown, size = "md" }: { card?: Card; faceDown?: boolean; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-[68px] w-[48px]" : size === "md" ? "h-[52px] w-[37px]" : "h-[40px] w-[29px]";
  const fontSize = size === "lg" ? "text-[15px]" : size === "md" ? "text-[12px]" : "text-[9px]";
  if (faceDown || !card) {
    return (
      <div
        className={`${dims} shrink-0 rounded-[5px] border border-black/50`}
        style={{
          background: "repeating-linear-gradient(135deg, #7a1620 0px, #7a1620 4px, #5c0f18 4px, #5c0f18 8px)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
        }}
      />
    );
  }
  const red = RED_SUITS.has(card.suit);
  return (
    <div
      className={`${dims} relative shrink-0 rounded-[5px] bg-[#f8f6f0] border border-black/30 flex flex-col items-center justify-center leading-none`}
      style={{ boxShadow: "0 2px 5px rgba(0,0,0,0.5)" }}
    >
      <span className={`${fontSize} font-black`} style={{ color: red ? "#b3231d" : "#111" }}>
        {RANK_LABEL[card.rank]}
      </span>
      <span className={`${fontSize} leading-none`} style={{ color: red ? "#b3231d" : "#111" }}>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}

function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  const chips = Math.min(4, Math.max(1, Math.ceil(amount / 40)));
  return (
    <div className="relative flex h-4 w-6 items-end justify-center">
      {Array.from({ length: chips }).map((_, i) => (
        <div
          key={i}
          className="absolute h-2.5 w-5 rounded-full border border-black/50"
          style={{
            bottom: i * 2.5,
            background: i % 2 === 0 ? "linear-gradient(180deg,#e0453f,#8f2622)" : "linear-gradient(180deg,#3a6bd6,#1c3d8f)",
          }}
        />
      ))}
    </div>
  );
}

function PokerPod({
  name,
  avatarUrl,
  isComputer,
  stack,
  active,
  align,
  isButton,
  badge,
}: {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  stack: number;
  active: boolean;
  align: "left" | "right";
  isButton: boolean;
  badge?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <div className="relative shrink-0">
          <div
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full p-[2px]"
            style={{
              background: active ? "hsl(var(--primary))" : "rgba(255,255,255,0.14)",
              boxShadow: active ? "0 0 14px hsl(var(--primary) / 0.6)" : undefined,
            }}
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0c1a12]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : isComputer ? (
                <Bot className="h-4 w-4 text-primary" />
              ) : (
                <span className="text-xs font-black text-primary">{name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>
          {active && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#0c1a12] bg-primary" />}
          {isButton && (
            <span
              className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-[#f5f2ea] text-[7px] font-black text-black"
              title="Dealer button"
            >
              D
            </span>
          )}
        </div>
        <p className="max-w-[9ch] truncate text-[11px] font-black leading-tight text-white">{name}</p>
      </div>
      <span className="text-[9px] font-black text-emerald-300">${stack}</span>
      {badge && (
        <span
          className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-primary-foreground"
          style={{ background: "hsl(var(--primary))", boxShadow: "0 0 10px hsl(var(--primary) / 0.7)" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function RaiseSheet({
  min,
  max,
  pot,
  onConfirm,
  onCancel,
}: {
  min: number;
  max: number;
  pot: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(() => Math.min(max, Math.max(min, min)));
  const preset = (v: number) => setAmount(Math.min(max, Math.max(min, v)));

  return (
    <div className="rounded-xl border border-white/15 bg-black/90 p-2.5 shadow-2xl animate-fade-in">
      <p className="mb-1.5 text-center text-[10px] font-black text-white">Raise to ${amount}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        <button type="button" onClick={() => preset(Math.round(pot * 0.5))} className="whitespace-nowrap rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-white active:scale-95">
          ½ Pot
        </button>
        <button type="button" onClick={() => preset(pot)} className="whitespace-nowrap rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-white active:scale-95">
          Pot
        </button>
        <button type="button" onClick={() => preset(max)} className="whitespace-nowrap rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-white active:scale-95">
          All In
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-white active:scale-95">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(amount)}
          className="rounded-full bg-primary px-4 py-1.5 text-[10px] font-black text-primary-foreground active:scale-95"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

export default function PokerTable({
  state,
  mySeat,
  myTurn,
  matchOver,
  myName,
  myAvatar,
  oppName,
  oppAvatar,
  isComputer,
  muted,
  onToggleMute,
  onBack,
  howToPlay,
  onAction,
  onNextHand,
  sideDock,
}: Props) {
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const [help, setHelp] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const handOver = state.street === "showdown" && state.phase === "active";
  const showdownReveal = handOver && state.lastHandResult?.reason === "showdown";
  const legal = legalActions(state, mySeat);

  useEffect(() => {
    setRaiseOpen(false);
  }, [state.handNumber, state.street, myTurn]);

  const resultText = (() => {
    if (!handOver || !state.lastHandResult) return null;
    const { winnerSeat, potWon, reason, winningHand } = state.lastHandResult;
    if (winnerSeat === null) return `Split pot — $${potWon}`;
    const who = winnerSeat === mySeat ? "You" : oppName;
    const how = reason === "fold" ? "by fold" : winningHand ? `with ${winningHand}` : "at showdown";
    return `${who} win${winnerSeat === mySeat ? "" : "s"} $${potWon} ${how}`;
  })();

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(140 30% 12%) 0%, hsl(140 35% 7%) 45%, hsl(140 40% 4%) 100%)",
        paddingLeft: "max(0.4rem, env(safe-area-inset-left))",
        paddingRight: "max(0.4rem, env(safe-area-inset-right))",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-full w-full items-stretch justify-center gap-1.5 px-0.5">
        {/* Table felt */}
        <div className="flex h-full flex-1 items-center justify-center">
          <div
            className="relative flex aspect-[16/9] max-h-full w-full max-w-[720px] items-center justify-center rounded-[46%]"
            style={{
              background: "radial-gradient(80% 70% at 50% 40%, #1c7a4e 0%, #0f5c39 55%, #083c26 100%)",
              border: "14px solid #3e2312",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6), inset 0 0 0 3px rgba(255,215,140,0.25)",
            }}
          >
            {/* Opponent hole cards */}
            <div className="absolute top-[8%] left-1/2 flex -translate-x-1/2 gap-1">
              <PlayingCard card={state.holeCards[oppSeat][0]} faceDown={!showdownReveal} size="sm" />
              <PlayingCard card={state.holeCards[oppSeat][1]} faceDown={!showdownReveal} size="sm" />
            </div>

            {/* Community cards + pot */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <PlayingCard key={i} card={state.community[i]} faceDown={i >= state.community.length} size="md" />
                ))}
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1">
                <ChipStack amount={state.pot} />
                <span className="text-[10px] font-black text-amber-200">Pot ${state.pot}</span>
              </div>
              {state.lastAction && !handOver && (
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/80">
                  {(state.lastAction.seat === mySeat ? "You: " : `${oppName}: `) + state.lastAction.message}
                </span>
              )}
            </div>

            {/* Street-side bet markers */}
            <div className="absolute top-[26%] left-1/2 -translate-x-1/2">
              {state.bets[oppSeat] > 0 && (
                <span className="rounded-full bg-black/45 px-2 py-0.5 text-[8px] font-bold text-white/80">${state.bets[oppSeat]}</span>
              )}
            </div>
            <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2">
              {state.bets[mySeat] > 0 && (
                <span className="rounded-full bg-black/45 px-2 py-0.5 text-[8px] font-bold text-white/80">${state.bets[mySeat]}</span>
              )}
            </div>

            {/* My hole cards */}
            <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 gap-1.5">
              <PlayingCard card={state.holeCards[mySeat][0]} faceDown={state.folded[mySeat] && handOver && !showdownReveal} size="lg" />
              <PlayingCard card={state.holeCards[mySeat][1]} faceDown={state.folded[mySeat] && handOver && !showdownReveal} size="lg" />
            </div>

            {handOver && resultText && (
              <div className="absolute inset-x-6 top-[63%] z-30 flex flex-col items-center gap-1.5 rounded-full bg-black/85 px-3 py-2 animate-fade-in">
                <p className="text-center text-[10px] font-black text-white">{resultText}</p>
                {!matchOver && (
                  <button
                    type="button"
                    onClick={onNextHand}
                    className="rounded-full bg-primary px-4 py-1 text-[9px] font-black text-primary-foreground active:scale-95"
                  >
                    Deal Next Hand
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex h-full shrink-0 flex-col items-end gap-1 py-1.5">
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={onToggleMute} aria-label={muted ? "Unmute sound" : "Mute sound"} className="rounded-full bg-black/55 p-1 text-white active:scale-95">
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-black/55 p-1 text-white active:scale-95">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <PokerPod
            name={oppName}
            avatarUrl={oppAvatar}
            isComputer={isComputer}
            stack={state.stacks[oppSeat]}
            active={state.turnSeat === oppSeat && !handOver && !matchOver}
            align="right"
            isButton={state.button === oppSeat}
            badge={state.turnSeat === oppSeat && !handOver && !matchOver ? "Their turn" : undefined}
          />

          <div className="relative flex min-h-0 flex-1 flex-col items-end justify-end gap-1.5 pb-1">
            {myTurn && !handOver && !matchOver && (
              <div className="flex flex-col gap-1.5">
                {legal.canRaise && (
                  <button
                    type="button"
                    onClick={() => setRaiseOpen((v) => !v)}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white active:scale-95"
                  >
                    Raise
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAction(legal.canCheck ? "check" : "call")}
                  className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-black text-primary-foreground active:scale-95"
                >
                  {legal.canCheck ? "Check" : `Call $${legal.toCall}`}
                </button>
                <button
                  type="button"
                  onClick={() => onAction("fold")}
                  className="rounded-full bg-red-700 px-3 py-1.5 text-[10px] font-black text-white active:scale-95"
                >
                  Fold
                </button>
              </div>
            )}
          </div>
          {sideDock ? <div className="flex shrink-0 justify-center pb-0.5">{sideDock}</div> : null}
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 top-0 z-30 flex items-start gap-1.5 px-2 pt-1.5">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto shrink-0 rounded-full bg-black/55 p-1 text-white active:scale-95">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <PokerPod
          name={myName}
          avatarUrl={myAvatar}
          stack={state.stacks[mySeat]}
          active={myTurn && !handOver && !matchOver}
          align="left"
          isButton={state.button === mySeat}
          badge={myTurn && !handOver && !matchOver ? "Your turn" : undefined}
        />
      </div>

      {help ? (
        <ul className="absolute inset-x-6 top-10 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[10px] text-white/80 animate-fade-in">
          {howToPlay.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}

      {raiseOpen && legal.canRaise && (
        <div className="absolute inset-x-6 bottom-2 z-40 mx-auto max-w-[280px]">
          <RaiseSheet
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            pot={state.pot}
            onConfirm={(amount) => {
              setRaiseOpen(false);
              onAction(amount >= legal.maxRaiseTo ? "all_in" : "raise", amount);
            }}
            onCancel={() => setRaiseOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
