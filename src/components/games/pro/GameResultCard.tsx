import { RotateCcw, Share2, Trophy, Users } from "lucide-react";

type Props = {
  open: boolean;
  outcome: "win" | "loss" | "draw";
  title: string;
  detail?: string;
  onRematch: () => void;
  onChallenge?: () => void;
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

  const confetti = outcome === "win"
    ? Array.from({ length: 26 }).map((_, i) => ({
        left: `${(i * 3.8 + (i % 5) * 4) % 100}%`,
        delay: `${(i % 8) * 0.12}s`,
        drift: `${((i % 7) - 3) * 18}px`,
        color: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "#f0d78c" : "#7de0a6",
      }))
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-6 backdrop-blur-sm animate-fade-in">
      {confetti.length ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="yaj-confetti-piece"
              style={{ left: c.left, animationDelay: c.delay, background: c.color, ["--drift" as any]: c.drift }}
            />
          ))}
        </div>
      ) : null}
      <div
        className="w-full max-w-[420px] rounded-3xl border p-5 text-center animate-scale-in"
        style={{
          borderColor: outcome === "win" ? "rgba(240,215,140,0.55)" : "hsl(var(--primary) / 0.3)",
          background: "linear-gradient(180deg, hsl(258 40% 12%), hsl(255 40% 8%))",
          boxShadow:
            outcome === "win"
              ? "0 0 50px rgba(240,215,140,0.35)"
              : "0 0 40px hsl(var(--primary) / 0.25)",
        }}
      >

        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              outcome === "win"
                ? "linear-gradient(160deg, #f8e6a8, #c79a2c)"
                : "hsl(var(--primary) / 0.15)",
            boxShadow:
              outcome === "win"
                ? "0 0 30px rgba(240,215,140,0.7)"
                : "0 0 24px hsl(var(--primary) / 0.4)",
          }}
        >
          <Trophy className={outcome === "win" ? "h-8 w-8 text-[#3a2a06]" : "h-8 w-8 text-primary"} />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-white">{title}</h2>
        {detail && <p className="mt-1 text-sm text-white/70">{detail}</p>}
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
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
          {onChallenge && (
            <button
              type="button"
              onClick={onChallenge}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
            >
              <Users className="h-4 w-4" /> Challenge Someone
            </button>
          )}
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" /> Share Result
          </button>
        </div>
      </div>
    </div>
  );
}
