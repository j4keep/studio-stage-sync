import { useState } from "react";
import { Bot, Gamepad2, Play, Trophy, UserRound, X } from "lucide-react";
import GameQuickActions, { GameMatchup, GameRecordStats } from "@/components/games/GameQuickActions";
import CharacterSkinPickerSheet from "@/components/CharacterSkinPickerSheet";

type Player = { name: string; avatarUrl?: string | null; isComputer?: boolean };

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  onStart: () => void;
  onBack: () => void;
  me: Player;
  them: Player;
  stats?: GameRecordStats | null;
  matchups?: GameMatchup[];
  onPlaySolo?: () => void;
  onQuickMatch?: () => void;
  /** Optional key art shown behind the splash, like the pool table's billiards poster. */
  artUrl?: string;
  /** Shows a "Customize Character" button that opens the shared skin-tone picker — only
   *  meaningful for games that render the illustrated ObbyAvatar-based character. */
  showCharacterCustomize?: boolean;
};

const ACCENT = "hsl(275 85% 68%)";

function Face({ p }: { p: Player }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full p-[2px]"
        style={{ background: ACCENT, boxShadow: `0 0 20px ${ACCENT}77` }}
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0c0718]">
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
          ) : p.isComputer ? (
            <Bot className="h-7 w-7" style={{ color: ACCENT }} />
          ) : (
            <span className="text-xl font-black" style={{ color: ACCENT }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <p className="max-w-[92px] truncate text-[11px] font-black text-white">{p.name}</p>
    </div>
  );
}

/** Shared pre-game splash: face-off, big start button, and the solo / quick match / record actions. */
export default function GameIntro({
  open,
  title,
  subtitle,
  onStart,
  onBack,
  me,
  them,
  stats,
  matchups,
  onPlaySolo,
  onQuickMatch,
  artUrl,
  showCharacterCustomize,
}: Props) {
  const [showSkinPicker, setShowSkinPicker] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] animate-fade-in"
      style={{
        background:
          "radial-gradient(110% 70% at 50% 0%, hsl(268 55% 22%) 0%, hsl(250 45% 10%) 55%, hsl(240 45% 5%) 100%)",
      }}
    >
      {artUrl && (
        <>
          <img
            src={artUrl}
            alt={`${title} key art`}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(6,4,14,0.35) 0%, rgba(6,4,14,0.45) 45%, rgba(6,4,14,0.92) 100%)",
            }}
          />
        </>
      )}
      <div className="relative z-10 flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Leave game"
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black text-white active:scale-95"
          style={{ borderColor: ACCENT, background: "rgba(10,6,20,0.7)", boxShadow: `0 0 14px ${ACCENT}55` }}
        >
          <Gamepad2 className="h-3.5 w-3.5" style={{ color: ACCENT }} /> YAJ Game
          <X className="ml-1 h-3 w-3 opacity-70" />
        </button>
        <div className="flex items-center gap-2">
          {showCharacterCustomize && (
            <button
              type="button"
              onClick={() => setShowSkinPicker(true)}
              aria-label="Customize character"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-white active:scale-95"
              style={{ borderColor: ACCENT, background: "rgba(10,6,20,0.7)", boxShadow: `0 0 14px ${ACCENT}55` }}
            >
              <UserRound className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              <span className="text-[9px] font-black leading-tight">Character</span>
            </button>
          )}
          <div
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-white"
            style={{ borderColor: ACCENT, background: "rgba(10,6,20,0.7)", boxShadow: `0 0 14px ${ACCENT}55` }}
          >
            <Trophy className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            <span className="text-[9px] font-black leading-tight">
              Wins
              <br />
              <span className="text-[11px]">{stats?.wins ?? 0}</span>
            </span>
          </div>
        </div>
      </div>

      {showCharacterCustomize && showSkinPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSkinPicker(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border p-4"
            style={{ borderColor: ACCENT, background: "hsl(255 40% 12%)", boxShadow: `0 0 30px ${ACCENT}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-white">Customize Character</p>
              <button
                type="button"
                onClick={() => setShowSkinPicker(false)}
                aria-label="Close"
                className="rounded-full bg-white/10 p-1.5 text-white active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <CharacterSkinPickerSheet />
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-4">
        {!artUrl && <h1 className="text-center text-3xl font-black text-white drop-shadow">{title}</h1>}

        <div className="flex items-center gap-5">
          <Face p={me} />
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            vs
          </span>
          <Face p={them} />
        </div>
        <p className="text-center text-xs font-bold italic text-white/80">{subtitle}</p>
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="flex w-full max-w-sm items-center justify-center gap-3 rounded-full px-7 py-3.5 text-white active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(275 75% 52%), hsl(255 80% 46%))",
            border: `2px solid ${ACCENT}`,
            boxShadow: `0 0 30px ${ACCENT}99, 0 6px 14px rgba(0,0,0,0.55)`,
          }}
        >
          <Play className="h-5 w-5" fill="currentColor" />
          <span className="text-left leading-tight">
            <span className="block text-lg font-black">Tap to Play</span>
            <span className="block text-[11px] font-semibold opacity-90">and Start the Game</span>
          </span>
        </button>

        <GameQuickActions
          stats={stats}
          matchups={matchups}
          onPlaySolo={onPlaySolo}
          onQuickMatch={onQuickMatch}
          accent={ACCENT}
        />
      </div>
    </div>
  );
}
