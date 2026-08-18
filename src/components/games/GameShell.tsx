import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Share2, Users } from "lucide-react";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import PlayerBadge, { ArenaPlayer } from "@/components/games/PlayerBadge";
import GameResultCard from "@/components/games/pro/GameResultCard";
import { toast } from "@/hooks/use-toast";

type Props = {
  title: string;
  subtitle: string;
  status: string;
  finished: boolean;
  shareText: string;
  onRematch: () => void;
  onChallenge: (opponentId: string, name: string) => void;
  children: ReactNode;
  /** Optional arena chrome */
  me?: ArenaPlayer;
  them?: ArenaPlayer;
  myTurn?: boolean;
  outcome?: "win" | "loss" | "draw";
  resultTitle?: string;
  resultDetail?: string;
  footer?: ReactNode;
};

export default function GameShell({
  title,
  subtitle,
  status,
  finished,
  shareText,
  onRematch,
  onChallenge,
  children,
  me,
  them,
  myTurn,
  outcome,
  resultTitle,
  resultDetail,
  footer,
}: Props) {
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Result copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  const showResult = Boolean(finished && outcome) && !resultDismissed;

  return (
    <div
      className="min-h-[100dvh] pb-28 text-white"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, hsl(230 40% 18%) 0%, hsl(232 42% 10%) 55%, hsl(234 45% 6%) 100%)",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[hsl(234_45%_7%_/_0.85)] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/games")}
            aria-label="Back"
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight">{title}</h1>
            <p className="truncate text-[11px] text-white/55">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {(me || them) && (
          <div className="mx-auto flex max-w-[420px] items-center justify-between gap-2">
            {me ? <PlayerBadge {...me} active={Boolean(myTurn)} /> : <span />}
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              vs
            </span>
            {them ? <PlayerBadge {...them} align="right" active={!finished && myTurn === false} /> : <span />}
          </div>
        )}

        <div
          className="mx-auto mt-3 max-w-[420px] rounded-2xl border border-primary/25 px-3 py-2.5 text-center"
          style={{
            background: "linear-gradient(180deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.05))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <p key={status} className="animate-fade-in text-sm font-black">
            {status}
          </p>
        </div>

        <div className="mt-5">{children}</div>

        {footer}

        {finished && (
          <div className="mx-auto mt-6 max-w-[380px] space-y-2">
            <button
              type="button"
              onClick={onRematch}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" /> Rematch
            </button>
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98]"
            >
              <Users className="h-4 w-4" /> Challenge Someone
            </button>
            <button
              type="button"
              onClick={share}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Share Result
            </button>
          </div>
        )}
      </main>

      {outcome && (
        <GameResultCard
          open={showResult}
          outcome={outcome}
          title={resultTitle || (outcome === "win" ? "You win!" : outcome === "draw" ? "It's a draw" : "You lost")}
          detail={resultDetail}
          onRematch={() => {
            setResultDismissed(true);
            onRematch();
          }}
          onChallenge={() => {
            setResultDismissed(true);
            setPicker(true);
          }}
          onShare={() => {
            setResultDismissed(true);
            void share();
          }}
        />
      )}

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(p) => {
          setPicker(false);
          onChallenge(p.user_id, p.display_name || "your opponent");
        }}
        title={`Challenge to ${title}`}
      />
    </div>
  );
}
