import { RotateCcw, Share2, Trophy, Users } from "lucide-react";

type Props = {
  open: boolean;
  outcome: "win" | "loss" | "draw";
  title: string;
  detail?: string;
  onRematch: () => void;
  onChallenge: () => void;
  onShare: () => void;
};

export default function GameResultCard({
  open,
  outcome,
  title,
  detail,
  onRematch,
  onChallenge,
  onShare,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/80 px-4 pb-8 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-[420px] rounded-3xl border border-primary/30 bg-card p-6 text-center animate-scale-in"
        style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.25)" }}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
          style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.4)" }}
        >
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight">{title}</h2>
        {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {outcome === "win" ? "Victory" : outcome === "draw" ? "Blocked game" : "Better luck next round"}
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onRematch}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" /> Rematch
          </button>
          <button
            type="button"
            onClick={onChallenge}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
          >
            <Users className="h-4 w-4" /> Challenge Someone
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" /> Share Result
          </button>
        </div>
      </div>
    </div>
  );
}
